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
(define-constant ERR-INVALID-ACCESS-LEVEL u1011)
(define-constant ERR-DOCUMENT-NOT-FOUND u1012)

;; Property status codes
(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-PENDING u2)
(define-constant STATUS-SUSPENDED u3)
(define-constant STATUS-ARCHIVED u4)

;; Access level codes
(define-constant ACCESS-OWNER u1)
(define-constant ACCESS-VERIFIER u2)
(define-constant ACCESS-ADMIN u3)
(define-constant ACCESS-PUBLIC u4)

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
  uint
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
  uint
  principal
)

;; Property transfer history - using composite key
(define-map property-transfers
  (tuple (property-id uint) (transfer-id uint))
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
  uint
  uint
)

;; Owner properties index
(define-map owner-properties
  (tuple (owner principal) (property-id uint))
  bool
)

;; Property verification status
(define-map property-verification
  uint
  (tuple
    (is-verified bool)
    (verified-by principal)
    (verification-date uint)
    (verification-notes (string-ascii 300))
  )
)

;; Property documents and attachments - using composite key
(define-map property-documents
  (tuple (property-id uint) (document-id uint))
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
  uint
  uint
)

;; Property status change history - using composite key
(define-map property-status-history
  (tuple (property-id uint) (change-id uint))
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
  uint
  uint
)

;; Access control for properties - using composite key
(define-map property-access-control
  (tuple (property-id uint) (accessor principal))
  (tuple
    (access-level uint)
    (granted-by principal)
    (granted-date uint)
    (expiry-date (optional uint))
    (is-active bool)
  )
)

;; Property search index by location
(define-map property-location-index
  (tuple (location (string-ascii 200)) (property-id uint))
  bool
)

;; Property search index by type
(define-map property-type-index
  (tuple (property-type (string-ascii 50)) (property-id uint))
  bool
)

;; System statistics
(define-data-var total-properties uint u0)
(define-data-var total-transfers uint u0)
(define-data-var total-verified-properties uint u0)

;; =============================================================================
;; PRIVATE FUNCTIONS
;; =============================================================================

;; Generate unique property ID
(define-private (generate-property-id)
  (let ((current-counter (var-get property-counter)))
    (var-set property-counter (+ current-counter u1))
    (+ current-counter u1)
  )
)

;; Generate unique transfer ID for a property
(define-private (generate-transfer-id (property-id uint))
  (let ((current-counter (default-to u0 (map-get? property-transfer-counter property-id))))
    (let ((new-counter (+ current-counter u1)))
      (map-set property-transfer-counter property-id new-counter)
      new-counter
    )
  )
)

;; Generate unique document ID for a property
(define-private (generate-document-id (property-id uint))
  (let ((current-counter (default-to u0 (map-get? property-document-counter property-id))))
    (let ((new-counter (+ current-counter u1)))
      (map-set property-document-counter property-id new-counter)
      new-counter
    )
  )
)

;; Generate unique status change ID for a property
(define-private (generate-status-change-id (property-id uint))
  (let ((current-counter (default-to u0 (map-get? property-status-counter property-id))))
    (let ((new-counter (+ current-counter u1)))
      (map-set property-status-counter property-id new-counter)
      new-counter
    )
  )
)

;; Check if principal is authorized to perform operations
(define-private (is-authorized (caller principal))
  (is-eq caller tx-sender)
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
      (is-eq (unwrap-panic owner) caller)
    )
  )
)

;; Update property last modified timestamp
(define-private (update-property-timestamp (property-id uint))
  (let ((metadata (map-get? property-metadata property-id)))
    (if (is-some metadata)
      (let ((current-metadata (unwrap-panic metadata)))
        (map-set property-metadata property-id
          (merge current-metadata
            {last-modified: (get-current-block-height)}
          )
        )
        true
      )
      false
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
    (map-set property-transfers 
      {property-id: property-id, transfer-id: transfer-id}
      {
        from-owner: from-owner,
        to-owner: to-owner,
        transfer-date: current-time,
        transfer-reason: reason,
        transfer-amount: amount
      }
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
  (begin
    ;; Remove from old owner
    (map-set owner-properties {owner: old-owner, property-id: property-id} false)
    ;; Add to new owner
    (map-set owner-properties {owner: new-owner, property-id: property-id} true)
    true
  )
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
    (map-set property-status-history 
      {property-id: property-id, change-id: change-id}
      {
        old-status: old-status,
        new-status: new-status,
        change-date: current-time,
        changed-by: changed-by,
        change-reason: reason
      }
    )
    change-id
  )
)

;; Validate status transition
(define-private (is-valid-status-transition (old-status uint) (new-status uint))
  (if (is-eq old-status STATUS-ACTIVE)
    ;; Active can transition to any status
    true
    (if (is-eq old-status STATUS-PENDING)
      ;; Pending can transition to Active or Suspended
      (or (is-eq new-status STATUS-ACTIVE) (is-eq new-status STATUS-SUSPENDED))
      (if (is-eq old-status STATUS-SUSPENDED)
        ;; Suspended can transition to Active or Archived
        (or (is-eq new-status STATUS-ACTIVE) (is-eq new-status STATUS-ARCHIVED))
        (if (is-eq old-status STATUS-ARCHIVED)
          ;; Archived cannot transition (final state)
          false
          ;; Default case
          false
        )
      )
    )
  )
)

;; Check access level for property
(define-private (has-access-level (property-id uint) (caller principal) (required-level uint))
  (if (is-property-owner property-id caller)
    ;; Owner has full access
    true
    ;; Check specific access control
    (let ((access-control (map-get? property-access-control {property-id: property-id, accessor: caller})))
      (if (is-none access-control)
        false
        (let ((access-info (unwrap-panic access-control)))
          (and
            (get is-active access-info)
            (>= (get access-level access-info) required-level)
          )
        )
      )
    )
  )
)

;; Update search indexes
(define-private (update-search-indexes (property-id uint) (location (string-ascii 200)) (property-type (string-ascii 50)) (is-active bool))
  (begin
    (map-set property-location-index {location: location, property-id: property-id} is-active)
    (map-set property-type-index {property-type: property-type, property-id: property-id} is-active)
    true
  )
)

;; Update system statistics
(define-private (update-statistics (property-id uint) (is-verified bool))
  (begin
    (var-set total-properties (+ (var-get total-properties) u1))
    (if is-verified
      (var-set total-verified-properties (+ (var-get total-verified-properties) u1))
      true
    )
    true
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
    (if (not (validate-property-data title description location property-type total-area area-unit))
      (err ERR-INVALID-PROPERTY-DATA)
      (let ((property-id (generate-property-id))
            (current-time (get-current-block-height)))
        (map-set property-metadata property-id
          {
            property-title: title,
            property-description: description,
            location: location,
            property-type: property-type,
            total-area: total-area,
            area-unit: area-unit,
            registration-date: current-time,
            last-modified: current-time,
            status: STATUS-ACTIVE
          }
        )
        (map-set property-owner property-id initial-owner)
        (map-set owner-properties {owner: initial-owner, property-id: property-id} true)
        (map-set property-verification property-id
          {
            is-verified: false,
            verified-by: tx-sender,
            verification-date: u0,
            verification-notes: ""
          }
        )
        ;; Update search indexes
        (update-search-indexes property-id location property-type true)
        ;; Update statistics
        (update-statistics property-id false)
        (ok property-id)
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
          (let ((current-owner (unwrap-panic (get-property-owner property-id))))
            ;; Record the transfer
            (record-transfer property-id current-owner new-owner reason amount)
            ;; Update ownership
            (map-set property-owner property-id new-owner)
            ;; Update owner properties index
            (update-owner-properties current-owner new-owner property-id)
            ;; Update timestamp
            (update-property-timestamp property-id)
            ;; Update transfer statistics
            (var-set total-transfers (+ (var-get total-transfers) u1))
            (ok true)
          )
        )
      )
    )
  )
)

;; Get property information
(define-read-only (get-property-info (property-id uint))
  (let ((metadata (map-get? property-metadata property-id))
        (owner (get-property-owner property-id)))
    (if (is-none metadata)
      (err ERR-PROPERTY-NOT-FOUND)
      (ok {
        property-id: property-id,
        metadata: (unwrap-panic metadata),
        owner: (unwrap-panic owner)
      })
    )
  )
)

;; Get property owner
(define-read-only (get-property-owner-public (property-id uint))
  (let ((owner (get-property-owner property-id)))
    (if (is-none owner)
      (err ERR-PROPERTY-NOT-FOUND)
      (ok (unwrap-panic owner))
    )
  )
)

;; Check if address owns property
(define-read-only (owns-property (property-id uint) (address principal))
  (ok (is-property-owner property-id address))
)

;; Get properties owned by an address
(define-read-only (get-owner-properties-public (owner principal) (property-id uint))
  (ok (default-to false (map-get? owner-properties {owner: owner, property-id: property-id})))
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
          (let ((current-metadata (unwrap-panic (map-get? property-metadata property-id))))
            (map-set property-metadata property-id
              (merge current-metadata
                {
                  property-title: new-title,
                  property-description: new-description,
                  location: new-location,
                  property-type: new-property-type,
                  total-area: new-total-area,
                  area-unit: new-area-unit,
                  last-modified: (get-current-block-height)
                }
              )
            )
            ;; Update search indexes with new location and type
            (update-search-indexes property-id new-location new-property-type true)
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
      (let ((verification (map-get? property-verification property-id)))
        (if (is-none verification)
          (err ERR-PROPERTY-NOT-FOUND)
          (let ((current-verification (unwrap-panic verification)))
            (if (get is-verified current-verification)
              (err ERR-ALREADY-VERIFIED)
              (let ((current-time (get-current-block-height)))
                (map-set property-verification property-id
                  {
                    is-verified: true,
                    verified-by: caller,
                    verification-date: current-time,
                    verification-notes: verification-notes
                  }
                )
                (update-property-timestamp property-id)
                ;; Update verified properties count
                (var-set total-verified-properties (+ (var-get total-verified-properties) u1))
                (ok true)
              )
            )
          )
        )
      )
    )
  )
)

;; Get property verification status
(define-read-only (get-property-verification (property-id uint))
  (let ((verification (map-get? property-verification property-id)))
    (if (is-none verification)
      (err ERR-PROPERTY-NOT-FOUND)
      (ok (unwrap-panic verification))
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
          (map-set property-documents 
            {property-id: property-id, document-id: document-id}
            {
              document-title: document-title,
              document-type: document-type,
              document-hash: document-hash,
              upload-date: current-time,
              uploaded-by: caller,
              document-description: document-description
            }
          )
          (update-property-timestamp property-id)
          (ok document-id)
        )
      )
    )
  )
)

;; Get property document by ID
(define-read-only (get-property-document (property-id uint) (document-id uint))
  (if (not (property-exists? property-id))
    (err ERR-PROPERTY-NOT-FOUND)
    (let ((document (map-get? property-documents {property-id: property-id, document-id: document-id})))
      (if (is-none document)
        (err ERR-DOCUMENT-NOT-FOUND)
        (ok (unwrap-panic document))
      )
    )
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
      (let ((metadata (map-get? property-metadata property-id)))
        (if (is-none metadata)
          (err ERR-PROPERTY-NOT-FOUND)
          (let ((current-metadata (unwrap-panic metadata))
                (current-status (get status current-metadata)))
            (if (not (is-valid-status-transition current-status new-status))
              (err ERR-INVALID-STATUS)
              (begin
                ;; Record status change
                (record-status-change property-id current-status new-status caller reason)
                ;; Update property status
                (map-set property-metadata property-id
                  (merge current-metadata
                    {
                      status: new-status,
                      last-modified: (get-current-block-height)
                    }
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

;; Get property transfer by ID
(define-read-only (get-property-transfer (property-id uint) (transfer-id uint))
  (if (not (property-exists? property-id))
    (err ERR-PROPERTY-NOT-FOUND)
    (let ((transfer (map-get? property-transfers {property-id: property-id, transfer-id: transfer-id})))
      (if (is-none transfer)
        (err ERR-TRANSFER-FAILED)
        (ok (unwrap-panic transfer))
      )
    )
  )
)

;; Grant access to property
(define-public (grant-property-access
  (property-id uint)
  (accessor principal)
  (access-level uint)
  (expiry-date (optional uint))
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-property-owner property-id caller))
        (err ERR-UNAUTHORIZED)
        (if (or (< access-level ACCESS-OWNER) (> access-level ACCESS-PUBLIC))
          (err ERR-INVALID-ACCESS-LEVEL)
          (let ((current-time (get-current-block-height)))
            (map-set property-access-control 
              {property-id: property-id, accessor: accessor}
              {
                access-level: access-level,
                granted-by: caller,
                granted-date: current-time,
                expiry-date: expiry-date,
                is-active: true
              }
            )
            (ok true)
          )
        )
      )
    )
  )
)

;; Revoke access to property
(define-public (revoke-property-access
  (property-id uint)
  (accessor principal)
)
  (let ((caller tx-sender))
    (if (not (property-exists? property-id))
      (err ERR-PROPERTY-NOT-FOUND)
      (if (not (is-property-owner property-id caller))
        (err ERR-UNAUTHORIZED)
        (let ((access-control (map-get? property-access-control {property-id: property-id, accessor: accessor})))
          (if (is-none access-control)
            (err ERR-DOCUMENT-NOT-FOUND)
            (let ((current-access (unwrap-panic access-control)))
              (map-set property-access-control 
                {property-id: property-id, accessor: accessor}
                (merge current-access {is-active: false})
              )
              (ok true)
            )
          )
        )
      )
    )
  )
)

;; Check if property exists in location
(define-read-only (property-exists-in-location (location (string-ascii 200)) (property-id uint))
  (default-to false (map-get? property-location-index {location: location, property-id: property-id}))
)

;; Check if property exists of type
(define-read-only (property-exists-of-type (property-type (string-ascii 50)) (property-id uint))
  (default-to false (map-get? property-type-index {property-type: property-type, property-id: property-id}))
)

;; Get system statistics
(define-read-only (get-system-statistics)
  (ok {
    total-properties: (var-get total-properties),
    total-transfers: (var-get total-transfers),
    total-verified-properties: (var-get total-verified-properties)
  })
)

;; Get property count
(define-read-only (get-property-count)
  (ok (var-get property-counter))
)

;; Check property access level
(define-read-only (check-property-access (property-id uint) (address principal) (required-level uint))
  (ok (has-access-level property-id address required-level))
)