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
(define-constant ERR-ALREADY-VERIFIED u1008)
(define-constant ERR-NOT-VERIFIED u1009)
(define-constant ERR-INVALID-STATUS u1010)

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

;; Property documents and attachments
(define-map property-documents
  (property-id uint)
  (document-id uint)
  (tuple
    (document-title (string-ascii 100))
    (document-type (string-ascii 50))
    (document-hash (string-ascii 64))
    (upload-date uint)
    (uploaded-by principal)
    (document-description (string-ascii 200))
  )
)

;; Document counter per property
(define-map property-document-counter
  (property-id uint)
  (counter uint)
)

;; Property status change history
(define-map property-status-history
  (property-id uint)
  (change-id uint)
  (tuple
    (old-status uint)
    (new-status uint)
    (change-date uint)
    (changed-by principal)
    (change-reason (string-ascii 200))
  )
)

;; Status change counter per property
(define-map property-status-counter
  (property-id uint)
  (counter uint)
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

;; Generate unique document ID for a property
(define-private (generate-document-id (property-id uint))
  (let ((current-counter (map-get? property-document-counter property-id)))
    (let ((new-counter (if (is-none current-counter) u1 (+ (unwrap current-counter) u1))))
      (map-set property-document-counter property-id new-counter)
      new-counter
)))

;; Generate unique status change ID for a property
(define-private (generate-status-change-id (property-id uint))
  (let ((current-counter (map-get? property-status-counter property-id)))
    (let ((new-counter (if (is-none current-counter) u1 (+ (unwrap current-counter) u1))))
      (map-set property-status-counter property-id new-counter)
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

;; Record status change
(define-private (record-status-change
  (property-id uint)
  (old-status uint)
  (new-status uint)
  (changed-by principal)
  (reason (string-ascii 200))
)
  (let ((change-id (generate-status-change-id property-id))
        (current-time (get-current-block-height)))
    (map-set property-status-history property-id change-id
      (tuple
        (old-status old-status)
        (new-status new-status)
        (change-date current-time)
        (changed-by changed-by)
        (change-reason reason)
      )
    )
    change-id
  )
)

;; Validate status transition
(define-private (is-valid-status-transition (old-status uint) (new-status uint))
  (cond
    ;; Active can transition to any status
    ((is-eq old-status STATUS-ACTIVE) true)
    ;; Pending can transition to Active or Suspended
    ((is-eq old-status STATUS-PENDING) 
     (or (is-eq new-status STATUS-ACTIVE) (is-eq new-status STATUS-SUSPENDED)))
    ;; Suspended can transition to Active or Archived
    ((is-eq old-status STATUS-SUSPENDED)
     (or (is-eq new-status STATUS-ACTIVE) (is-eq new-status STATUS-ARCHIVED)))
    ;; Archived cannot transition (final state)
    ((is-eq old-status STATUS-ARCHIVED) false)
    ;; Default case
    (true false)
  )
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

;; Verify property (only by authorized verifier)
(define-public (verify-property
  (property-id uint)
  (verification-notes (string-ascii 300))
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-authorized caller))
        (err ERR-UNAUTHORIZED)
        (let ((verification (map-get? property-verification property-id)))
          (if (is-none verification)
            (err ERR-PROPERTY-NOT-FOUND)
            (let ((current-verification (unwrap verification)))
              (if (get is-verified current-verification)
                (err ERR-ALREADY-VERIFIED)
                (let ((current-time (get-current-block-height)))
                  (map-set property-verification property-id
                    (tuple
                      (is-verified true)
                      (verified-by caller)
                      (verification-date current-time)
                      (verification-notes verification-notes)
                    )
                  )
                  (update-property-timestamp property-id)
                  (ok true)
                )
              )
            )
          )
        )
      )
    )
  )
)

;; Get property verification status
(define-public (get-property-verification (property-id uint))
  (let ((verification (map-get? property-verification property-id)))
    (if (is-none verification)
      (err ERR-PROPERTY-NOT-FOUND)
      (ok (unwrap verification))
    )
  )
)

;; Add document to property
(define-public (add-property-document
  (property-id uint)
  (document-title (string-ascii 100))
  (document-type (string-ascii 50))
  (document-hash (string-ascii 64))
  (document-description (string-ascii 200))
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-property-owner property-id caller))
        (err ERR-UNAUTHORIZED)
        (let ((document-id (generate-document-id property-id))
              (current-time (get-current-block-height)))
          (map-set property-documents property-id document-id
            (tuple
              (document-title document-title)
              (document-type document-type)
              (document-hash document-hash)
              (upload-date current-time)
              (uploaded-by caller)
              (document-description document-description)
            )
          )
          (update-property-timestamp property-id)
          (ok document-id)
        )
      )
    )
  )
)

;; Get property documents
(define-public (get-property-documents (property-id uint))
  (if (not (property-exists? property-id))
    (err ERR-PROPERTY-NOT-FOUND)
    (ok (map-get? property-documents property-id))
  )
)

;; Change property status
(define-public (change-property-status
  (property-id uint)
  (new-status uint)
  (reason (string-ascii 200))
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-authorized caller))
        (err ERR-UNAUTHORIZED)
        (let ((metadata (map-get? property-metadata property-id)))
          (if (is-none metadata)
            (err ERR-PROPERTY-NOT-FOUND)
            (let ((current-metadata (unwrap metadata))
                  (current-status (get status current-metadata)))
              (if (not (is-valid-status-transition current-status new-status))
                (err ERR-INVALID-STATUS)
                (begin
                  ;; Record status change
                  (record-status-change property-id current-status new-status caller reason)
                  ;; Update property status
                  (map-set property-metadata property-id
                    (merge current-metadata
                      (tuple
                        (status new-status)
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
    )
  )
)

;; Get property status history
(define-public (get-property-status-history (property-id uint))
  (if (not (property-exists? property-id))
    (err ERR-PROPERTY-NOT-FOUND)
    (ok (map-get? property-status-history property-id))
  )
)

;; Get property transfer history
(define-public (get-property-transfer-history (property-id uint))
  (if (not (property-exists? property-id))
    (err ERR-PROPERTY-NOT-FOUND)
    (ok (map-get? property-transfers property-id))
  )
)
