[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://127.0.0.1:3013',
  [switch]$IncludePageChecks
)

$base = $BaseUrl
$results = @()
$isMockMode = $env:DEV_MOCK_MODE -eq 'true'
$shouldRunPageChecks = $IncludePageChecks.IsPresent -or -not $isMockMode

function Add-Result {
  param(
    [string]$step,
    [bool]$ok,
    [string]$detail
  )
  $script:results += [pscustomobject]@{
    step = $step
    ok = $ok
    detail = $detail
  }
}

if ($shouldRunPageChecks) {
  try {
    $r = Invoke-WebRequest -Uri "$base/auth/sign-up" -UseBasicParsing
    Add-Result 'signup-page-reachable' ($r.StatusCode -eq 200) "status=$($r.StatusCode)"
  } catch {
    Add-Result 'signup-page-reachable' $false $_.Exception.Message
  }

  try {
    $r = Invoke-WebRequest -Uri "$base/dashboard/listings/new" -UseBasicParsing
    Add-Result 'listing-page-reachable' ($r.StatusCode -eq 200) "status=$($r.StatusCode)"
  } catch {
    Add-Result 'listing-page-reachable' $false $_.Exception.Message
  }
} else {
  Add-Result 'signup-page-reachable' $true 'skipped: mock mode api-only run'
  Add-Result 'listing-page-reachable' $true 'skipped: mock mode api-only run'
}

$listing = $null
$auction = $null
$haul = $null
$haulBid = $null

try {
  $listingPayload = @{ category='excavator'; make='Hitachi'; model='ZX200'; year=2021; description='Flow check listing'; locationCity='Denver'; locationState='CO'} | ConvertTo-Json -Compress
  $listing = Invoke-RestMethod -Uri "$base/api/listings" -Method Post -ContentType 'application/json' -Body $listingPayload
  Add-Result 'create-listing' $true "listingId=$($listing.id)"
} catch {
  Add-Result 'create-listing' $false $_.Exception.Message
}

try {
  $upload = Invoke-RestMethod -Uri "$base/api/listings/upload-photos" -Method Post
  Add-Result 'upload-photos-endpoint' ($upload.ok -eq $true) "ok=$($upload.ok)"
} catch {
  Add-Result 'upload-photos-endpoint' $false $_.Exception.Message
}

if ($listing) {
  try {
    $auctionPayload = @{ listingId=$listing.id; type='timed'; startTime=(Get-Date).ToUniversalTime().ToString('o'); endTime=(Get-Date).ToUniversalTime().AddDays(1).ToString('o'); startingBid=75000; minIncrement=1000 } | ConvertTo-Json -Compress
    $auction = Invoke-RestMethod -Uri "$base/api/auctions" -Method Post -ContentType 'application/json' -Body $auctionPayload
    Add-Result 'create-auction' $true "auctionId=$($auction.id)"
  } catch {
    Add-Result 'create-auction' $false $_.Exception.Message
  }
} else {
  Add-Result 'create-auction' $false 'skipped: listing not created'
}

if ($auction) {
  try {
    $auctionGet = Invoke-RestMethod -Uri "$base/api/auctions/$($auction.id)" -Method Get
    Add-Result 'get-auction-detail' ($auctionGet.id -eq $auction.id) "id=$($auctionGet.id)"
  } catch {
    Add-Result 'get-auction-detail' $false $_.Exception.Message
  }

  try {
    $bidPayload = @{ auctionId=$auction.id; amount=76000 } | ConvertTo-Json -Compress
    $bid = Invoke-RestMethod -Uri "$base/api/bids" -Method Post -ContentType 'application/json' -Body $bidPayload
    Add-Result 'place-bid' ($bid.bid.amount -eq 76000) "bidId=$($bid.bid.id) amount=$($bid.bid.amount)"
  } catch {
    Add-Result 'place-bid' $false $_.Exception.Message
  }
} else {
  Add-Result 'get-auction-detail' $false 'skipped: auction not created'
  Add-Result 'place-bid' $false 'skipped: auction not created'
}

try {
  $haulPayload = @{ transaction_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; pickup_address='100 Mine Rd, Denver, CO'; delivery_address='500 Yard St, Cheyenne, WY'; trailer_type='lowboy'; special_requirements=@('escort if required'); bid_window_hrs='24' } | ConvertTo-Json -Compress
  $haul = Invoke-RestMethod -Uri "$base/api/haul-jobs" -Method Post -ContentType 'application/json' -Body $haulPayload
  Add-Result 'create-haul-job' $true "haulJobId=$($haul.id)"
} catch {
  Add-Result 'create-haul-job' $false $_.Exception.Message
}

if ($haul) {
  try {
    $haulGet = Invoke-RestMethod -Uri "$base/api/haul-jobs/$($haul.id)" -Method Get
    Add-Result 'get-haul-job-detail' ($haulGet.id -eq $haul.id) "id=$($haulGet.id)"
  } catch {
    Add-Result 'get-haul-job-detail' $false $_.Exception.Message
  }

  try {
    $haulBidPayload = @{ haulJobId=$haul.id; amount=3200; includesPermits=$false; includesPilotCar=$false; trailerType='lowboy' } | ConvertTo-Json -Compress
    $haulBid = Invoke-RestMethod -Uri "$base/api/haul-bids" -Method Post -ContentType 'application/json' -Body $haulBidPayload
    Add-Result 'submit-haul-quote' ($haulBid.amount -eq 3200) "haulBidId=$($haulBid.id) amount=$($haulBid.amount)"
  } catch {
    Add-Result 'submit-haul-quote' $false $_.Exception.Message
  }
} else {
  Add-Result 'get-haul-job-detail' $false 'skipped: haul job not created'
  Add-Result 'submit-haul-quote' $false 'skipped: haul job not created'
}

if ($haul -and $haulBid) {
  try {
    $awardPayload = @{ bidId=$haulBid.id } | ConvertTo-Json -Compress
    $award = Invoke-RestMethod -Uri "$base/api/haul-jobs/$($haul.id)/award" -Method Patch -ContentType 'application/json' -Body $awardPayload
    Add-Result 'award-haul-bid' ($award.status -eq 'awarded') "status=$($award.status)"
  } catch {
    Add-Result 'award-haul-bid' $false $_.Exception.Message
  }

  try {
    $confirm = Invoke-RestMethod -Uri "$base/api/haul-jobs/$($haul.id)/confirm-delivery" -Method Post
    Add-Result 'confirm-delivery-payment-release' ($confirm.success -eq $true) "success=$($confirm.success) mocked=$($confirm.mocked)"
  } catch {
    Add-Result 'confirm-delivery-payment-release' $false $_.Exception.Message
  }
} else {
  Add-Result 'award-haul-bid' $false 'skipped: haul quote not submitted'
  Add-Result 'confirm-delivery-payment-release' $false 'skipped: haul quote not submitted'
}

$results | ConvertTo-Json -Compress
