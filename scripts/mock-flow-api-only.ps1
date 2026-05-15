[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://127.0.0.1:3013'
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$results = @()

function Add-Result {
  param(
    [string]$Step,
    [bool]$Ok,
    [string]$Detail
  )

  $script:results += [pscustomobject]@{
    step = $Step
    ok = $Ok
    detail = $Detail
  }
}

function Invoke-Json {
  param(
    [ValidateSet('GET','POST','PATCH')]
    [string]$Method,
    [string]$Path,
    [object]$Body
  )

  $uri = "$base$Path"

  if ($null -eq $Body) {
    return Invoke-RestMethod -Uri $uri -Method $Method -TimeoutSec 20
  }

  $payload = $Body | ConvertTo-Json -Compress -Depth 8
  return Invoke-RestMethod -Uri $uri -Method $Method -ContentType 'application/json' -Body $payload -TimeoutSec 20
}

$listing = $null
$auction = $null
$bid = $null
$haul = $null
$haulBid = $null
$award = $null
$confirm = $null

try {
  $listing = Invoke-Json -Method POST -Path '/api/listings' -Body @{
    category = 'excavator'
    make = 'Hitachi'
    model = 'ZX200'
    year = 2021
    description = 'API only full-flow check'
    locationCity = 'Denver'
    locationState = 'CO'
  }
  Add-Result -Step 'seller-create-listing' -Ok $true -Detail "listingId=$($listing.id)"
} catch {
  Add-Result -Step 'seller-create-listing' -Ok $false -Detail $_.Exception.Message
}

try {
  $upload = Invoke-Json -Method POST -Path '/api/listings/upload-photos' -Body $null
  Add-Result -Step 'seller-upload-photos-endpoint' -Ok ($upload.ok -eq $true) -Detail "ok=$($upload.ok)"
} catch {
  Add-Result -Step 'seller-upload-photos-endpoint' -Ok $false -Detail $_.Exception.Message
}

if ($listing) {
  try {
    $auction = Invoke-Json -Method POST -Path '/api/auctions' -Body @{
      listingId = $listing.id
      type = 'timed'
      startTime = (Get-Date).ToUniversalTime().ToString('o')
      endTime = (Get-Date).ToUniversalTime().AddDays(1).ToString('o')
      startingBid = 75000
      minIncrement = 1000
    }
    Add-Result -Step 'seller-create-auction' -Ok $true -Detail "auctionId=$($auction.id)"
  } catch {
    Add-Result -Step 'seller-create-auction' -Ok $false -Detail $_.Exception.Message
  }
} else {
  Add-Result -Step 'seller-create-auction' -Ok $false -Detail 'skipped: listing not created'
}

if ($auction) {
  try {
    $auctionDetail = Invoke-Json -Method GET -Path "/api/auctions/$($auction.id)" -Body $null
    Add-Result -Step 'buyer-view-auction' -Ok ($auctionDetail.id -eq $auction.id) -Detail "id=$($auctionDetail.id)"
  } catch {
    Add-Result -Step 'buyer-view-auction' -Ok $false -Detail $_.Exception.Message
  }

  try {
    $bid = Invoke-Json -Method POST -Path '/api/bids' -Body @{
      auctionId = $auction.id
      amount = 76000
    }
    Add-Result -Step 'buyer-place-bid' -Ok ($bid.bid.amount -eq 76000) -Detail "bidId=$($bid.bid.id) amount=$($bid.bid.amount)"
  } catch {
    Add-Result -Step 'buyer-place-bid' -Ok $false -Detail $_.Exception.Message
  }
} else {
  Add-Result -Step 'buyer-view-auction' -Ok $false -Detail 'skipped: auction not created'
  Add-Result -Step 'buyer-place-bid' -Ok $false -Detail 'skipped: auction not created'
}

try {
  $haul = Invoke-Json -Method POST -Path '/api/haul-jobs' -Body @{
    transaction_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    pickup_address = '100 Mine Rd, Denver, CO'
    delivery_address = '500 Yard St, Cheyenne, WY'
    trailer_type = 'lowboy'
    special_requirements = @('escort if required')
    bid_window_hrs = '24'
  }
  Add-Result -Step 'buyer-create-haul-job' -Ok $true -Detail "haulJobId=$($haul.id)"
} catch {
  Add-Result -Step 'buyer-create-haul-job' -Ok $false -Detail $_.Exception.Message
}

if ($haul) {
  try {
    $haulDetail = Invoke-Json -Method GET -Path "/api/haul-jobs/$($haul.id)" -Body $null
    Add-Result -Step 'buyer-view-haul-job' -Ok ($haulDetail.id -eq $haul.id) -Detail "id=$($haulDetail.id)"
  } catch {
    Add-Result -Step 'buyer-view-haul-job' -Ok $false -Detail $_.Exception.Message
  }

  try {
    $haulBid = Invoke-Json -Method POST -Path '/api/haul-bids' -Body @{
      haulJobId = $haul.id
      amount = 3200
      includesPermits = $false
      includesPilotCar = $false
      trailerType = 'lowboy'
    }
    Add-Result -Step 'carrier-submit-haul-quote' -Ok ($haulBid.amount -eq 3200) -Detail "haulBidId=$($haulBid.id) amount=$($haulBid.amount)"
  } catch {
    Add-Result -Step 'carrier-submit-haul-quote' -Ok $false -Detail $_.Exception.Message
  }
} else {
  Add-Result -Step 'buyer-view-haul-job' -Ok $false -Detail 'skipped: haul job not created'
  Add-Result -Step 'carrier-submit-haul-quote' -Ok $false -Detail 'skipped: haul job not created'
}

if ($haul -and $haulBid) {
  try {
    $award = Invoke-Json -Method PATCH -Path "/api/haul-jobs/$($haul.id)/award" -Body @{ bidId = $haulBid.id }
    Add-Result -Step 'buyer-award-haul-bid' -Ok ($award.status -eq 'awarded') -Detail "status=$($award.status)"
  } catch {
    Add-Result -Step 'buyer-award-haul-bid' -Ok $false -Detail $_.Exception.Message
  }

  try {
    $confirm = Invoke-Json -Method POST -Path "/api/haul-jobs/$($haul.id)/confirm-delivery" -Body $null
    Add-Result -Step 'buyer-confirm-delivery-and-release' -Ok ($confirm.success -eq $true) -Detail "success=$($confirm.success) mocked=$($confirm.mocked)"
  } catch {
    Add-Result -Step 'buyer-confirm-delivery-and-release' -Ok $false -Detail $_.Exception.Message
  }
} else {
  Add-Result -Step 'buyer-award-haul-bid' -Ok $false -Detail 'skipped: haul quote not submitted'
  Add-Result -Step 'buyer-confirm-delivery-and-release' -Ok $false -Detail 'skipped: haul quote not submitted'
}

$results | ConvertTo-Json -Compress
