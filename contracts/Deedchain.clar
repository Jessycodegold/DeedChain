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

;; Check if property exists
(define-private (property-exists? (property-id uint))
  (is-some (map-get? property-metadata property-id))
)

;; Get property owner
(define-private (get-property-owner (property-id uint))
  (map-get? property-owner property-id)
)

;; Check if caller is property owner
(define-private (is-property-owner (property-id uint) (caller principal))
  (let ((owner (get-property-owner property-id)))
    (if (is-none owner)
      false
      (is-eq (unwrap owner) caller)
    )
  )
)

;; Update property last modified timestamp
(define-private (update-property-timestamp (property-id uint))
  (let ((metadata (map-get? property-metadata property-id)))
    (if (is-some metadata)
      (let ((current-metadata (unwrap metadata)))
        (map-set property-metadata property-id
          (merge current-metadata
            (tuple (last-modified (get-current-block-height)))
          )
        )
      )
    )
  )
)

;; Record property transfer
(define-private (record-transfer
  (property-id uint)
  (from-owner principal)
  (to-owner principal)
  (reason (string-ascii 200))
  (amount (optional uint))
)
  (let ((transfer-id (generate-transfer-id property-id))
        (current-time (get-current-block-height)))
    (map-set property-transfers property-id transfer-id
      (tuple
        (from-owner from-owner)
        (to-owner to-owner)
        (transfer-date current-time)
        (transfer-reason reason)
        (transfer-amount amount)
      )
    )
    transfer-id
  )
)

;; Update owner properties index
(define-private (update-owner-properties
  (old-owner principal)
  (new-owner principal)
  (property-id uint)
)
  ;; Remove from old owner
  (map-set owner-properties old-owner property-id false)
  ;; Add to new owner
  (map-set owner-properties new-owner property-id true)
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

;; Transfer property ownership
(define-public (transfer-property
  (property-id uint)
  (new-owner principal)
  (reason (string-ascii 200))
  (amount (optional uint))
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-property-owner property-id caller))
        (err ERR-UNAUTHORIZED)
        (if (is-eq caller new-owner)
          (err ERR-INVALID-OWNER)
          (let ((current-owner (unwrap (get-property-owner property-id))))
            ;; Record the transfer
            (record-transfer property-id current-owner new-owner reason amount)
            ;; Update ownership
            (map-set property-owner property-id new-owner)
            ;; Update owner properties index
            (update-owner-properties current-owner new-owner property-id)
            ;; Update timestamp
            (update-property-timestamp property-id)
            (ok true)
          )
        )
      )
    )
  )
)

;; Get property information
(define-public (get-property-info (property-id uint))
  (let ((metadata (map-get? property-metadata property-id))
        (owner (get-property-owner property-id)))
    (if (is-none metadata)
      (err ERR-PROPERTY-NOT-FOUND)
      (ok (tuple
        (property-id property-id)
        (metadata (unwrap metadata))
        (owner (unwrap owner))
      ))
    )
  )
)

;; Get property owner
(define-public (get-property-owner-public (property-id uint))
  (let ((owner (get-property-owner property-id)))
    (if (is-none owner)
      (err ERR-PROPERTY-NOT-FOUND)
      (ok (unwrap owner))
    )
  )
)

;; Check if address owns property
(define-public (owns-property (property-id uint) (address principal))
  (ok (is-property-owner property-id address))
)

;; Get properties owned by an address
(define-public (get-owner-properties (owner principal))
  (ok (map-get? owner-properties owner))
)

;; Update property metadata (only by owner)
(define-public (update-property-metadata
  (property-id uint)
  (new-title (string-ascii 100))
  (new-description (string-ascii 500))
  (new-location (string-ascii 200))
  (new-property-type (string-ascii 50))
  (new-total-area uint)
  (new-area-unit (string-ascii 20))
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-property-owner property-id caller))
        (err ERR-UNAUTHORIZED)
        (if (not (validate-property-data new-title new-description new-location new-property-type new-total-area new-area-unit))
          (err ERR-INVALID-PROPERTY-DATA)
          (let ((current-metadata (unwrap (map-get? property-metadata property-id))))
            (map-set property-metadata property-id
              (merge current-metadata
                (tuple
                  (property-title new-title)
                  (property-description new-description)
                  (location new-location)
                  (property-type new-property-type)
                  (total-area new-total-area)
                  (area-unit new-area-unit)
                  (last-modified (get-current-block-height))
                )
              )
            )
            (ok true)
          )
        )
      )
    )
  )
)
