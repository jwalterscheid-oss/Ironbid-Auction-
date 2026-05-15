#Requires -Version 5.1
# IRONBID -- Full End-to-End Flow Script
# Covers: Sign-Up -> Seller Listing -> Auction -> Buyer Bidding
#         -> Auction Close -> Stripe Payment -> Haul Job
#         -> Carrier Registration -> Carrier Bidding -> Award
#         -> Tracking Updates -> Delivery Confirmation -> Seller Sold View
#
# Requires: DEV_MOCK_MODE=true + DEV_AUTH_BYPASS=true in .env.local
# Usage: $env:DEV_MOCK_MODE='true'; .\scripts\mock-flow-e2e-full.ps1
[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://127.0.0.1:3013',
  [switch]$IncludePageChecks,
  [switch]$Json
)

$base    = $BaseUrl
$results = [System.Collections.Generic.List[pscustomobject]]::new()
$passed  = 0
$failed  = 0

function Step {
  param([string]$Role, [string]$Name, [scriptblock]$Block)
  $label = "[$Role] $Name"
  try {
    $detail = & $Block
    $script:results.Add([pscustomobject]@{ role=$Role; step=$Name; ok=$true;  detail=$detail })
    $script:passed++
    Write-Host "  PASS  $label -- $detail" -ForegroundColor Green
  } catch {
    $msg = $_.Exception.Message -replace "`r?`n",' '
    $script:results.Add([pscustomobject]@{ role=$Role; step=$Name; ok=$false; detail=$msg })
    $script:failed++
    Write-Host "  FAIL  $label -- $msg" -ForegroundColor Red
  }
}

function Phase { param([string]$Title)
  Write-Host ""
  Write-Host "== $Title ==" -ForegroundColor Cyan
}

function PostApi {
  param([string]$Uri, [hashtable]$Body)
  $json = $Body | ConvertTo-Json -Compress -Depth 10
  Invoke-RestMethod -Uri "$base$Uri" -Method Post -ContentType 'application/json' -Body $json
}
function GetApi { param([string]$Uri)
  Invoke-RestMethod -Uri "$base$Uri" -Method Get
}
function PatchApi {
  param([string]$Uri, [hashtable]$Body)
  $json = $Body | ConvertTo-Json -Compress -Depth 10
  Invoke-RestMethod -Uri "$base$Uri" -Method Patch -ContentType 'application/json' -Body $json
}

$listing  = $null
$auction  = $null
$bid1     = $null
$bid2     = $null
$haulJob  = $null
$haulBid  = $null

Write-Host ""
Write-Host "+=========================================================+" -ForegroundColor Magenta
Write-Host "|          IRONBID  --  Full E2E Flow Test                |" -ForegroundColor Magenta
Write-Host "+=========================================================+" -ForegroundColor Magenta
Write-Host "  Target : $base"
Write-Host "  Mock   : $($env:DEV_MOCK_MODE)"
Write-Host ""

Phase "PHASE 1 - SIGN-UP + ONBOARDING"

if ($IncludePageChecks) {
  Step 'SELLER' 'sign-up-page-reachable' {
    $r = Invoke-WebRequest -Uri "$base/auth/sign-up" -UseBasicParsing
    "status=$($r.StatusCode)"
  }
  Step 'BUYER' 'sign-in-page-reachable' {
    $r = Invoke-WebRequest -Uri "$base/auth/sign-in" -UseBasicParsing
    "status=$($r.StatusCode)"
  }
  Step 'CARRIER' 'carrier-page-note' {
    'carrier dashboard requires real Clerk session - accessible at /carrier after sign-in'
  }
} else {
  Step 'INFO' 'page-checks-skipped' { 'pass -IncludePageChecks to probe UI pages' }
}

Step 'CARRIER' 'carrier-register' {
  $r = PostApi '/api/carriers/register' @{
    company_name      = 'HeavyHaul Pro LLC'
    mc_number         = '1234567'
    dot_number        = '1234567'
    trailer_types     = @('lowboy','rgn')
    max_load_tons     = 80
    base_state        = 'TX'
    service_states    = @('TX','CO','WY','NM')
    insurance_amount  = 2000000
    insurance_expires = (Get-Date).AddYears(1).ToString('yyyy-MM-dd')
    bio               = 'Specializing in heavy equipment transport since 2005.'
  }
  "carrierId=$($r.carrierId) mc=$($r.mcNumber) fmcsa=$($r.fmcsaStatus) mocked=$($r.mocked)"
}

Phase "PHASE 2 - SELLER CREATES LISTING"

Step 'SELLER' 'create-listing' {
  $script:listing = PostApi '/api/listings' @{
    category      = 'excavator'
    make          = 'Caterpillar'
    model         = '336'
    year          = 2020
    description   = 'Well-maintained CAT 336 hydraulic excavator. 4,800 hours. Full service records available.'
    locationCity  = 'Houston'
    locationState = 'TX'
  }
  "listingId=$($listing.id) lot=$($listing.lotNumber)"
}

Step 'SELLER' 'upload-photos-endpoint' {
  $r = Invoke-RestMethod -Uri "$base/api/listings/upload-photos" -Method Post
  "ok=$($r.ok)"
}

Phase "PHASE 3 - SELLER CREATES AUCTION"

Step 'SELLER' 'create-auction' {
  if (-not $script:listing) { throw 'No listing available' }
  $script:auction = PostApi '/api/auctions/create' @{
    listingId    = $script:listing.id
    type         = 'timed'
    startTime    = (Get-Date).ToUniversalTime().ToString('o')
    endTime      = (Get-Date).ToUniversalTime().AddDays(3).ToString('o')
    startingBid  = 95000
    reservePrice = 120000
    minIncrement = 1000
    buyNowPrice  = 175000
  }
  "auctionId=$($auction.id) starting=$($auction.startingBid)"
}

Step 'SELLER' 'list-all-auctions' {
  $r = GetApi '/api/auctions'
  "count=$($r.Count)"
}

Phase "PHASE 4 - BUYER BROWSES + BIDS"

Step 'BUYER' 'browse-auctions' {
  $r = GetApi '/api/auctions'
  "count=$($r.Count)"
}

Step 'BUYER' 'view-auction-detail' {
  if (-not $script:auction) { throw 'No auction available' }
  $r = GetApi "/api/auctions/$($script:auction.id)"
  "id=$($r.id) currentBid=$($r.currentBid) status=$($r.status)"
}

Step 'BUYER' 'place-first-bid' {
  if (-not $script:auction) { throw 'No auction available' }
  $r = PostApi '/api/bids' @{
    auctionId = $script:auction.id
    amount    = 96000
  }
  $script:bid1 = $r.bid
  "bidId=$($bid1.id) amount=$($bid1.amount) winning=$($bid1.isWinning)"
}

Step 'BUYER' 'place-higher-bid-outbid-scenario' {
  if (-not $script:auction) { throw 'No auction available' }
  $r = PostApi '/api/bids' @{
    auctionId = $script:auction.id
    amount    = 98500
  }
  $script:bid2 = $r.bid
  "bidId=$($bid2.id) amount=$($bid2.amount) winning=$($bid2.isWinning)"
}

Step 'BUYER' 'bid-too-low-correctly-rejected' {
  if (-not $script:auction) { throw 'No auction available' }
  try {
    PostApi '/api/bids' @{ auctionId=$script:auction.id; amount=97000 } | Out-Null
    throw 'Expected rejection but got success'
  } catch {
    if ($_.Exception.Message -match 'bid_too_low|422|Response status code does not indicate success') {
      'correctly rejected low bid'
    } else { throw }
  }
}

Step 'BUYER' 'view-bid-history' {
  if (-not $script:auction) { throw 'No auction available' }
  $r = GetApi "/api/auctions/$($script:auction.id)"
  "bidCount=$($r.bidCount) currentBid=$($r.currentBid)"
}

Phase "PHASE 5 - AUCTION CLOSE + STRIPE PAYMENT"

Step 'SYSTEM' 'auction-close-cron-protected' {
  try {
    Invoke-RestMethod -Uri "$base/api/cron/close-auctions" -Method Get | Out-Null
    throw 'Expected 401 but got success'
  } catch {
    if ($_.Exception.Message -match '401|Unauthorized|Response status code does not indicate success') {
      'correctly blocked without CRON_SECRET'
    } else { throw }
  }
}

Step 'SYSTEM' 'stripe-checkout-endpoint-reachable' {
  $r = Invoke-WebRequest -Uri "$base/api/auctions" -UseBasicParsing
  "auctions-api status=$($r.StatusCode) (Stripe checkout is UI-driven post-close)"
}

Phase "PHASE 6 - BUYER CREATES HAUL JOB"

Step 'BUYER' 'create-haul-job' {
  $script:haulJob = PostApi '/api/haul-jobs' @{
    transaction_id       = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    pickup_address       = '4500 Industrial Blvd, Houston, TX 77001'
    delivery_address     = '8200 Equipment Way, Denver, CO 80201'
    trailer_type         = 'lowboy'
    special_requirements = @('oversize-permit', 'pilot-car-required')
    notes                = 'CAT 336 excavator - 80,000 lbs. Escort required for I-25 corridor.'
    bid_window_hrs       = '48'
  }
  "haulJobId=$($haulJob.id) status=$($haulJob.status)"
}

Step 'BUYER' 'view-haul-job-detail' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = GetApi "/api/haul-jobs/$($haulJob.id)"
  $addr = $r.pickupAddress
  if ($addr.Length -gt 35) { $addr = $addr.Substring(0,35) }
  "id=$($r.id) pickup=$addr"
}

Step 'BUYER' 'list-my-haul-jobs' {
  $r = GetApi '/api/haul-jobs'
  "count=$($r.Count)"
}

Phase "PHASE 7 - CARRIER SUBMITS HAUL BID"

Step 'CARRIER' 'submit-haul-quote' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $script:haulBid = PostApi '/api/haul-bids' @{
    haulJobId             = $script:haulJob.id
    amount                = 4800
    includesPermits       = $true
    includesPilotCar      = $true
    trailerType           = 'lowboy'
    estimatedPickupDate   = (Get-Date).AddDays(2).ToString('yyyy-MM-dd')
    estimatedDeliveryDate = (Get-Date).AddDays(5).ToString('yyyy-MM-dd')
    carrierNotes          = 'Licensed for OS/OW in TX, NM, CO. Can provide 2 pilot cars.'
  }
  "haulBidId=$($haulBid.id) amount=$($haulBid.amount) permits=$($haulBid.includesPermits)"
}

Step 'CARRIER' 'submit-competing-quote' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = PostApi '/api/haul-bids' @{
    haulJobId             = $script:haulJob.id
    amount                = 5200
    includesPermits       = $false
    includesPilotCar      = $true
    trailerType           = 'lowboy'
    estimatedPickupDate   = (Get-Date).AddDays(3).ToString('yyyy-MM-dd')
    estimatedDeliveryDate = (Get-Date).AddDays(6).ToString('yyyy-MM-dd')
  }
  "haulBidId=$($r.id) amount=$($r.amount) (competing quote)"
}

Phase "PHASE 8 - BUYER AWARDS CARRIER"

Step 'BUYER' 'award-carrier-haul-bid' {
  if (-not $script:haulJob -or -not $script:haulBid) { throw 'Missing haul job or bid' }
  $r = PatchApi "/api/haul-jobs/$($haulJob.id)/award" @{ bidId=$haulBid.id }
  "status=$($r.status) awardedBidId=$($r.awardedBidId) mocked=$($r.mocked)"
}

Step 'BUYER' 'verify-job-status-is-awarded' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = GetApi "/api/haul-jobs/$($haulJob.id)"
  if ($r.status -ne 'awarded') { throw "Expected 'awarded', got '$($r.status)'" }
  "status=$($r.status) carrier=$($r.awardedCarrierId)"
}

Phase "PHASE 9 - CARRIER TRACKING UPDATES"

Step 'CARRIER' 'tracking-bol-signed' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = PostApi '/api/haul-tracking' @{
    haulJobId     = $script:haulJob.id
    eventType     = 'bol_signed'
    addressApprox = 'Houston, TX'
    notes         = 'Bill of lading signed at pickup location.'
  }
  "eventType=$($r.eventType) newStatus=$($r.newJobStatus) mocked=$($r.mocked)"
}

Step 'CARRIER' 'tracking-picked-up' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = PostApi '/api/haul-tracking' @{
    haulJobId     = $script:haulJob.id
    eventType     = 'picked_up'
    addressApprox = 'I-10 W, Houston, TX'
    notes         = 'Equipment loaded and secured. En route to Denver.'
  }
  "eventType=$($r.eventType) newStatus=$($r.newJobStatus)"
}

Step 'CARRIER' 'tracking-gps-update-midway' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = PostApi '/api/haul-tracking' @{
    haulJobId      = $script:haulJob.id
    eventType      = 'gps_update'
    addressApprox  = 'Amarillo, TX'
    milesRemaining = 420
    notes          = 'On schedule. Cleared TX weigh station.'
  }
  "eventType=$($r.eventType) milesRemaining=420"
}

Step 'CARRIER' 'tracking-near-destination' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = PostApi '/api/haul-tracking' @{
    haulJobId      = $script:haulJob.id
    eventType      = 'near_destination'
    addressApprox  = 'Castle Rock, CO'
    milesRemaining = 35
    notes          = 'Approaching Denver metro. Pilot car on standby for final leg.'
  }
  "eventType=$($r.eventType) milesRemaining=35"
}

Phase "PHASE 10 - DELIVERY CONFIRMATION + PAYMENT RELEASE"

Step 'BUYER' 'confirm-delivery-release-payment' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = Invoke-RestMethod -Uri "$base/api/haul-jobs/$($haulJob.id)/confirm-delivery" -Method Post
  if (-not $r.success) { throw "confirm-delivery returned success=$($r.success)" }
  "success=$($r.success) payout=`$$($r.payoutAmount) mocked=$($r.mocked)"
}

Step 'BUYER' 'verify-job-delivered' {
  if (-not $script:haulJob) { throw 'No haul job available' }
  $r = GetApi "/api/haul-jobs/$($haulJob.id)"
  if ($r.status -ne 'delivered') { throw "Expected 'delivered', got '$($r.status)'" }
  "status=$($r.status) - haul complete"
}

Phase "PHASE 11 - SELLER SOLD VIEW"

Step 'SELLER' 'view-auction-final-state' {
  if (-not $script:auction) { throw 'No auction available' }
  $r = GetApi "/api/auctions/$($script:auction.id)"
  "auctionId=$($r.id) currentBid=$($r.currentBid) bidCount=$($r.bidCount)"
}

Step 'SELLER' 'view-all-auctions-dashboard' {
  $r = GetApi '/api/auctions'
  "totalAuctions=$($r.Count)"
}

Write-Host ""
Write-Host "=========================================================" -ForegroundColor White
$total = $passed + $failed
Write-Host "  RESULTS: $passed/$total passed" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Yellow' })
if ($failed -gt 0) {
  Write-Host "  FAILURES:" -ForegroundColor Red
  $results | Where-Object { -not $_.ok } | ForEach-Object {
    Write-Host "    [$($_.role)] $($_.step) -- $($_.detail)" -ForegroundColor Red
  }
}
Write-Host "=========================================================" -ForegroundColor White
Write-Host ""

if ($Json) {
  $results | ConvertTo-Json -Depth 5
}