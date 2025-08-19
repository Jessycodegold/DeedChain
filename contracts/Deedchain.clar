;; DeedChain - On-chain land and property deed registry
;; A comprehensive smart contract for managing property deeds with transfer history
;; and ownership verification on the Stacks blockchain.

;; =============================================================================
;; CONSTANTS
;; =============================================================================

;; Error codes
(define-constant ERR-UNAUTHORIZED u1001)
(define-constant ERR-PROPERTY-NOT-FOUND u1002)
(define-constant ERR-INVALID-OWNER u1003)
(define-constant ERR-PROPERTY-ALREADY-EXISTS u1004)
(define-constant ERR-INVALID-PROPERTY-DATA u1005)
(define-constant ERR-TRANSFER-FAILED u1006)
(define-constant ERR-INSUFFICIENT-BALANCE u1007)

;; Property status codes
(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-PENDING u2)
(define-constant STATUS-SUSPENDED u3)
(define-constant STATUS-ARCHIVED u4)

;; Maximum values
(define-constant MAX-PROPERTY-DESCRIPTION-LENGTH u500)
(define-constant MAX-LOCATION-LENGTH u200)
(define-constant MAX-OWNER-NAME-LENGTH u100)

;; =============================================================================
;; DATA TYPES
;; =============================================================================

;; Property deed structure
(define-data-var property-counter uint u0)

;; Property metadata - stores comprehensive property information
(define-map property-metadata
  (property-id uint)
  (tuple
    (property-title (string-ascii 100))
    (property-description (string-ascii 500))
    (location (string-ascii 200))
    (property-type (string-ascii 50))
    (total-area uint)
    (area-unit (string-ascii 20))
    (registration-date uint)
    (last-modified uint)
    (status uint)
  )
)

;; Property ownership
(define-map property-owner
  (property-id uint)
  (owner principal)
)

;; Property transfer history
(define-map property-transfers
  (property-id uint)
  (transfer-id uint)
  (tuple
    (from-owner principal)
    (to-owner principal)
    (transfer-date uint)
    (transfer-reason (string-ascii 200))
    (transfer-amount (optional uint))
  )
)

;; Transfer counter per property
(define-map property-transfer-counter
  (property-id uint)
  (counter uint)
)

;; Owner properties index
(define-map owner-properties
  (owner principal)
  (property-id uint)
  (is-active bool)
)

;; Property verification status
(define-map property-verification
  (property-id uint)
  (tuple
    (is-verified bool)
    (verified-by principal)
    (verification-date uint)
    (verification-notes (string-ascii 300))
  )
)

;; =============================================================================
;; PRIVATE FUNCTIONS
;; =============================================================================

;; Generate unique property ID
(define-private (generate-property-id)
  (let ((current-counter (var-get property-counter)))
    (var-set property-counter (+ current-counter u1))
    current-counter
))

;; Generate unique transfer ID for a property
(define-private (generate-transfer-id (property-id uint))
  (let ((current-counter (map-get? property-transfer-counter property-id)))
    (let ((new-counter (if (is-none current-counter) u1 (+ (unwrap current-counter) u1))))
      (map-set property-transfer-counter property-id new-counter)
      new-counter
)))

;; Check if principal is authorized to perform operations
(define-private (is-authorized (caller principal))
  (is-eq caller (as-contract tx-sender))
)

;; Validate property data
(define-private (validate-property-data
  (title (string-ascii 100))
  (description (string-ascii 500))
  (location (string-ascii 200))
  (property-type (string-ascii 50))
  (total-area uint)
  (area-unit (string-ascii 20))
)
  (and
    (> (len title) u0)
    (> (len description) u0)
    (> (len location) u0)
    (> (len property-type) u0)
    (> total-area u0)
    (> (len area-unit) u0)
  )
)

;; Get current block height
(define-private (get-current-block-height)
  block-height
)

;; =============================================================================
;; PUBLIC FUNCTIONS
;; =============================================================================

;; Register a new property deed
(define-public (register-property
  (title (string-ascii 100))
  (description (string-ascii 500))
  (location (string-ascii 200))
  (property-type (string-ascii 50))
  (total-area uint)
  (area-unit (string-ascii 20))
  (initial-owner principal)
)
  (let ((caller tx-sender))
    (if (not (is-authorized caller))
      (err ERR-UNAUTHORIZED)
      (if (not (validate-property-data title description location property-type total-area area-unit))
        (err ERR-INVALID-PROPERTY-DATA)
        (let ((property-id (generate-property-id))
              (current-time (get-current-block-height)))
          (map-set property-metadata property-id
            (tuple
              (property-title title)
              (property-description description)
              (location location)
              (property-type property-type)
              (total-area total-area)
              (area-unit area-unit)
              (registration-date current-time)
              (last-modified current-time)
              (status STATUS-ACTIVE)
            )
          )
          (map-set property-owner property-id initial-owner)
          (map-set owner-properties initial-owner property-id true)
          (map-set property-verification property-id
            (tuple
              (is-verified false)
              (verified-by (as-contract tx-sender))
              (verification-date u0)
              (verification-notes "")
            )
          )
          (ok property-id)
        )
      )
    )
  )
)
