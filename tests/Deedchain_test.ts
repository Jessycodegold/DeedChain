
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// =============================================================================
// COMMIT 1: CORE PROPERTY FUNCTIONS TEST SUITE
// Tests for property registration, ownership verification, and basic property information retrieval
// =============================================================================

Clarinet.test({
    name: "Property Registration - Successfully register a new property with valid data",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Beautiful Family Home"),
                types.ascii("A spacious 3-bedroom house with garden and garage"),
                types.ascii("123 Main Street, Springfield, IL"),
                types.ascii("Residential"),
                types.uint(2500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        // Property should be successfully registered
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectUint(1);
        
                // Verify property information
        let propertyInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [types.uint(1)], wallet1.address);
        const propertyData = propertyInfo.result.expectOk().expectTuple() as any;
        assertEquals(propertyData['property-id'], types.uint(1));
        assertEquals(propertyData['owner'], wallet1.address);
    },
});

Clarinet.test({
    name: "Property Registration - Reject registration with invalid property data",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Test with empty title
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii(""), // Empty title should fail
                types.ascii("A spacious 3-bedroom house with garden and garage"),
                types.ascii("123 Main Street, Springfield, IL"),
                types.ascii("Residential"),
                types.uint(2500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1005); // ERR-INVALID-PROPERTY-DATA
        
        // Test with zero area
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Valid Title"),
                types.ascii("Valid description"),
                types.ascii("Valid location"),
                types.ascii("Residential"),
                types.uint(0), // Zero area should fail
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1005); // ERR-INVALID-PROPERTY-DATA
    },
});

Clarinet.test({
    name: "Property Ownership - Verify property ownership correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Test Property"),
                types.ascii("Test Description"),
                types.ascii("Test Location"),
                types.ascii("Commercial"),
                types.uint(1000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Check ownership
        let ownershipCheck = chain.callReadOnlyFn('Deedchain', 'owns-property', [
            types.uint(1), 
            types.principal(wallet1.address)
        ], wallet1.address);
        ownershipCheck.result.expectOk().expectBool(true);
        
        // Check non-ownership
        let nonOwnershipCheck = chain.callReadOnlyFn('Deedchain', 'owns-property', [
            types.uint(1), 
            types.principal(wallet2.address)
        ], wallet2.address);
        nonOwnershipCheck.result.expectOk().expectBool(false);
        
        // Get property owner
        let ownerCheck = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet1.address);
        ownerCheck.result.expectOk().expectPrincipal(wallet1.address);
    },
});

Clarinet.test({
    name: "Property Information - Retrieve complete property information",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Register a property with specific details
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Luxury Villa"),
                types.ascii("Modern luxury villa with pool and ocean view"),
                types.ascii("456 Ocean Drive Miami FL"),
                types.ascii("Luxury Residential"),
                types.uint(5000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Get property information and verify all fields
        let propertyInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [types.uint(1)], wallet1.address);
        const result = propertyInfo.result.expectOk().expectTuple() as any;
        
        assertEquals(result['property-id'], types.uint(1));
        assertEquals(result['owner'], wallet1.address);
        
        const metadata = result['metadata'].expectTuple() as any;
        assertEquals(metadata['property-title'], types.ascii("Luxury Villa"));
        assertEquals(metadata['property-description'], types.ascii("Modern luxury villa with pool and ocean view"));
        assertEquals(metadata['location'], types.ascii("456 Ocean Drive Miami FL"));
        assertEquals(metadata['property-type'], types.ascii("Luxury Residential"));
        assertEquals(metadata['total-area'], types.uint(5000));
        assertEquals(metadata['area-unit'], types.ascii("sqft"));
        assertEquals(metadata['status'], types.uint(1)); // STATUS-ACTIVE
    },
});

Clarinet.test({
    name: "Property Information - Handle non-existent property gracefully",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Try to get info for non-existent property
        let propertyInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [types.uint(999)], wallet1.address);
        propertyInfo.result.expectErr().expectUint(1002); // ERR-PROPERTY-NOT-FOUND
        
        // Try to get owner for non-existent property
        let ownerInfo = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [types.uint(999)], wallet1.address);
        ownerInfo.result.expectErr().expectUint(1002); // ERR-PROPERTY-NOT-FOUND
        
        // Try to check ownership for non-existent property
        let ownershipCheck = chain.callReadOnlyFn('Deedchain', 'owns-property', [
            types.uint(999), 
            types.principal(wallet1.address)
        ], wallet1.address);
        ownershipCheck.result.expectOk().expectBool(false);
    },
});

Clarinet.test({
    name: "Property Registration - Multiple properties with incremental IDs",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Register first property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("First Property"),
                types.ascii("First property description"),
                types.ascii("First Location"),
                types.ascii("Residential"),
                types.uint(1500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Second Property"),
                types.ascii("Second property description"),
                types.ascii("Second Location"),
                types.ascii("Commercial"),
                types.uint(3000),
                types.ascii("sqft"),
                types.principal(wallet2.address)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        block.receipts[0].result.expectOk().expectUint(1);
        block.receipts[1].result.expectOk().expectUint(2);
        
        // Verify both properties exist and have correct owners
        let property1Info = chain.callReadOnlyFn('Deedchain', 'get-property-info', [types.uint(1)], wallet1.address);
        let property2Info = chain.callReadOnlyFn('Deedchain', 'get-property-info', [types.uint(2)], wallet2.address);
        
        assertEquals((property1Info.result.expectOk().expectTuple() as any)['owner'], wallet1.address);
        assertEquals((property2Info.result.expectOk().expectTuple() as any)['owner'], wallet2.address);
        
        // Check property count
        let propertyCount = chain.callReadOnlyFn('Deedchain', 'get-property-count', [], wallet1.address);
        propertyCount.result.expectOk().expectUint(2);
    },
});

// =============================================================================
// COMMIT 2: PROPERTY TRANSFERS TEST SUITE
// Tests for property transfer functionality, ownership changes, and transfer history
// =============================================================================

Clarinet.test({
    name: "Property Transfer - Successfully transfer property to new owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Register a property first
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("House for Transfer"),
                types.ascii("A house that will be transferred"),
                types.ascii("789 Transfer Street"),
                types.ascii("Residential"),
                types.uint(2000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Transfer property from wallet1 to wallet2
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet2.address),
                types.ascii("Sale transaction"),
                types.some(types.uint(250000))
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify ownership has changed
        let ownerCheck = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet2.address);
        ownerCheck.result.expectOk().expectPrincipal(wallet2.address);
        
        // Verify old owner no longer owns the property
        let oldOwnerCheck = chain.callReadOnlyFn('Deedchain', 'owns-property', [
            types.uint(1), 
            types.principal(wallet1.address)
        ], wallet1.address);
        oldOwnerCheck.result.expectOk().expectBool(false);
        
        // Verify new owner owns the property
        let newOwnerCheck = chain.callReadOnlyFn('Deedchain', 'owns-property', [
            types.uint(1), 
            types.principal(wallet2.address)
        ], wallet2.address);
        newOwnerCheck.result.expectOk().expectBool(true);
    },
});

Clarinet.test({
    name: "Property Transfer - Reject unauthorized transfer attempts",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const wallet3 = accounts.get('wallet_3')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Protected Property"),
                types.ascii("This property should not be transferable by non-owners"),
                types.ascii("999 Secure Lane"),
                types.ascii("Residential"),
                types.uint(1800),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Try to transfer property from wallet2 (not owner) to wallet3
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet3.address),
                types.ascii("Unauthorized attempt"),
                types.none()
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1001); // ERR-UNAUTHORIZED
        
        // Verify ownership has not changed
        let ownerCheck = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet1.address);
        ownerCheck.result.expectOk().expectPrincipal(wallet1.address);
    },
});

Clarinet.test({
    name: "Property Transfer - Handle non-existent property transfer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Try to transfer non-existent property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(999), // Non-existent property
                types.principal(wallet2.address),
                types.ascii("Transfer attempt"),
                types.none()
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1002); // ERR-PROPERTY-NOT-FOUND
    },
});

Clarinet.test({
    name: "Property Transfer - Reject self-transfer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Self Transfer Test"),
                types.ascii("Testing self transfer rejection"),
                types.ascii("123 Self Street"),
                types.ascii("Commercial"),
                types.uint(5000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Try to transfer property to self
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet1.address), // Same as current owner
                types.ascii("Self transfer attempt"),
                types.none()
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1003); // ERR-INVALID-OWNER
    },
});

Clarinet.test({
    name: "Property Transfer - Verify transfer history recording",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const wallet3 = accounts.get('wallet_3')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("History Property"),
                types.ascii("Property to test transfer history"),
                types.ascii("456 History Ave"),
                types.ascii("Residential"),
                types.uint(3000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // First transfer: wallet1 → wallet2
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet2.address),
                types.ascii("First sale"),
                types.some(types.uint(300000))
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Second transfer: wallet2 → wallet3
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet3.address),
                types.ascii("Second sale"),
                types.some(types.uint(350000))
            ], wallet2.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify final ownership
        let finalOwner = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet3.address);
        finalOwner.result.expectOk().expectPrincipal(wallet3.address);
        
        // Check transfer history (first transfer)
        let transfer1 = chain.callReadOnlyFn('Deedchain', 'get-property-transfer', [
            types.uint(1),
            types.uint(1)
        ], wallet1.address);
        
        const transferData1 = transfer1.result.expectOk().expectTuple() as any;
        assertEquals(transferData1['from-owner'], wallet1.address);
        assertEquals(transferData1['to-owner'], wallet2.address);
        assertEquals(transferData1['transfer-reason'], types.ascii("First sale"));
        assertEquals(transferData1['transfer-amount'], types.some(types.uint(300000)));
        
        // Check transfer history (second transfer)
        let transfer2 = chain.callReadOnlyFn('Deedchain', 'get-property-transfer', [
            types.uint(1),
            types.uint(2)
        ], wallet2.address);
        
        const transferData2 = transfer2.result.expectOk().expectTuple() as any;
        assertEquals(transferData2['from-owner'], wallet2.address);
        assertEquals(transferData2['to-owner'], wallet3.address);
        assertEquals(transferData2['transfer-reason'], types.ascii("Second sale"));
        assertEquals(transferData2['transfer-amount'], types.some(types.uint(350000)));
    },
});

Clarinet.test({
    name: "Property Transfer - Multiple properties with different owners",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const wallet3 = accounts.get('wallet_3')!;
        
        // Register multiple properties with different owners
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Property A"),
                types.ascii("First property for multi-transfer test"),
                types.ascii("100 Alpha Street"),
                types.ascii("Residential"),
                types.uint(2200),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Property B"),
                types.ascii("Second property for multi-transfer test"),
                types.ascii("200 Beta Street"),
                types.ascii("Commercial"),
                types.uint(4500),
                types.ascii("sqft"),
                types.principal(wallet2.address)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        block.receipts[0].result.expectOk().expectUint(1);
        block.receipts[1].result.expectOk().expectUint(2);
        
        // Transfer Property A from wallet1 to wallet3
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet3.address),
                types.ascii("Property A transfer"),
                types.some(types.uint(280000))
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Transfer Property B from wallet2 to wallet1
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(2),
                types.principal(wallet1.address),
                types.ascii("Property B transfer"),
                types.some(types.uint(450000))
            ], wallet2.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify final ownership states
        let property1Owner = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet3.address);
        property1Owner.result.expectOk().expectPrincipal(wallet3.address);
        
        let property2Owner = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(2)
        ], wallet1.address);
        property2Owner.result.expectOk().expectPrincipal(wallet1.address);
        
        // Verify owner-properties relationships
        let wallet3OwnsProperty1 = chain.callReadOnlyFn('Deedchain', 'get-owner-properties-public', [
            types.principal(wallet3.address),
            types.uint(1)
        ], wallet3.address);
        wallet3OwnsProperty1.result.expectOk().expectBool(true);
        
        let wallet1OwnsProperty2 = chain.callReadOnlyFn('Deedchain', 'get-owner-properties-public', [
            types.principal(wallet1.address),
            types.uint(2)
        ], wallet1.address);
        wallet1OwnsProperty2.result.expectOk().expectBool(true);
    },
});

// =============================================================================
// COMMIT 3: PROPERTY VERIFICATION & DOCUMENT MANAGEMENT TEST SUITE
// Tests for property verification system, document management, metadata updates, and status changes
// =============================================================================

Clarinet.test({
    name: "Property Verification - Successfully verify property",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!; // Acts as verifier
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Property to Verify"),
                types.ascii("This property will be verified"),
                types.ascii("123 Verification Street"),
                types.ascii("Commercial"),
                types.uint(3500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Check initial verification status
        let initialVerification = chain.callReadOnlyFn('Deedchain', 'get-property-verification', [
            types.uint(1)
        ], wallet1.address);
        
        const initialData = initialVerification.result.expectOk().expectTuple() as any;
        assertEquals(initialData['is-verified'], types.bool(false));
        
        // Verify the property
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'verify-property', [
                types.uint(1),
                types.ascii("Property verified by licensed inspector - meets all requirements")
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Check verification status after verification
        let verifiedStatus = chain.callReadOnlyFn('Deedchain', 'get-property-verification', [
            types.uint(1)
        ], wallet1.address);
        
        const verifiedData = verifiedStatus.result.expectOk().expectTuple() as any;
        assertEquals(verifiedData['is-verified'], types.bool(true));
        assertEquals(verifiedData['verified-by'], wallet2.address);
        assertEquals(verifiedData['verification-notes'], types.ascii("Property verified by licensed inspector - meets all requirements"));
    },
});

Clarinet.test({
    name: "Property Verification - Reject double verification",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Register and verify property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Double Verify Test"),
                types.ascii("Testing double verification rejection"),
                types.ascii("456 Double Street"),
                types.ascii("Residential"),
                types.uint(2800),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // First verification
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'verify-property', [
                types.uint(1),
                types.ascii("First verification")
            ], wallet2.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Attempt second verification
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'verify-property', [
                types.uint(1),
                types.ascii("Second verification attempt")
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1008); // ERR-ALREADY-VERIFIED
    },
});

Clarinet.test({
    name: "Document Management - Add document to property",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Document Property"),
                types.ascii("Property for document testing"),
                types.ascii("789 Document Ave"),
                types.ascii("Residential"),
                types.uint(2100),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Add a document
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'add-property-document', [
                types.uint(1),
                types.ascii("Property Survey"),
                types.ascii("Survey"),
                types.ascii("abc123def456789hash"), // Document hash
                types.ascii("Official property boundary survey conducted by licensed surveyor")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectUint(1); // Document ID
        
        // Retrieve the document
        let documentData = chain.callReadOnlyFn('Deedchain', 'get-property-document', [
            types.uint(1), // Property ID
            types.uint(1)  // Document ID
        ], wallet1.address);
        
        const docInfo = documentData.result.expectOk().expectTuple() as any;
        assertEquals(docInfo['document-title'], types.ascii("Property Survey"));
        assertEquals(docInfo['document-type'], types.ascii("Survey"));
        assertEquals(docInfo['document-hash'], types.ascii("abc123def456789hash"));
        assertEquals(docInfo['uploaded-by'], wallet1.address);
        assertEquals(docInfo['document-description'], types.ascii("Official property boundary survey conducted by licensed surveyor"));
    },
});

Clarinet.test({
    name: "Document Management - Unauthorized document addition",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Secure Property"),
                types.ascii("Property with document security"),
                types.ascii("999 Secure Lane"),
                types.ascii("Commercial"),
                types.uint(4000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Try to add document as non-owner
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'add-property-document', [
                types.uint(1),
                types.ascii("Unauthorized Doc"),
                types.ascii("Fraud"),
                types.ascii("fakehash123"),
                types.ascii("Unauthorized document attempt")
            ], wallet2.address) // wallet2 is not the owner
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1001); // ERR-UNAUTHORIZED
    },
});

Clarinet.test({
    name: "Metadata Updates - Successfully update property metadata",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Original Title"),
                types.ascii("Original description"),
                types.ascii("Original Location"),
                types.ascii("Residential"),
                types.uint(2000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Update property metadata
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'update-property-metadata', [
                types.uint(1),
                types.ascii("Updated Title"),
                types.ascii("Updated description with improvements"),
                types.ascii("Updated Location Address"),
                types.ascii("Mixed-Use"),
                types.uint(2500),
                types.ascii("sqft")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify updated metadata
        let updatedInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [
            types.uint(1)
        ], wallet1.address);
        
        const result = updatedInfo.result.expectOk().expectTuple() as any;
        const metadata = result['metadata'].expectTuple() as any;
        
        assertEquals(metadata['property-title'], types.ascii("Updated Title"));
        assertEquals(metadata['property-description'], types.ascii("Updated description with improvements"));
        assertEquals(metadata['location'], types.ascii("Updated Location Address"));
        assertEquals(metadata['property-type'], types.ascii("Mixed-Use"));
        assertEquals(metadata['total-area'], types.uint(2500));
    },
});

Clarinet.test({
    name: "Metadata Updates - Unauthorized update attempt",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        
        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Protected Property"),
                types.ascii("Property with update protection"),
                types.ascii("123 Protected St"),
                types.ascii("Residential"),
                types.uint(1800),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Try to update as non-owner
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'update-property-metadata', [
                types.uint(1),
                types.ascii("Hacked Title"),
                types.ascii("Unauthorized change"),
                types.ascii("Hacker Address"),
                types.ascii("Fraudulent"),
                types.uint(9999),
                types.ascii("sqft")
            ], wallet2.address) // wallet2 is not the owner
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1001); // ERR-UNAUTHORIZED
    },
});

Clarinet.test({
    name: "Status Management - Change property status",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Register a property (starts as STATUS-ACTIVE = 1)
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Status Test Property"),
                types.ascii("Property for status testing"),
                types.ascii("456 Status Street"),
                types.ascii("Commercial"),
                types.uint(3000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Check initial status (should be ACTIVE = 1)
        let initialInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [
            types.uint(1)
        ], wallet1.address);
        
        const initialData = initialInfo.result.expectOk().expectTuple() as any;
        const initialMetadata = initialData['metadata'].expectTuple() as any;
        assertEquals(initialMetadata['status'], types.uint(1)); // STATUS-ACTIVE
        
        // Change status to PENDING (2)
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(2), // STATUS-PENDING
                types.ascii("Property undergoing inspection")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Verify status change
        let updatedInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [
            types.uint(1)
        ], wallet1.address);
        
        const updatedData = updatedInfo.result.expectOk().expectTuple() as any;
        const updatedMetadata = updatedData['metadata'].expectTuple() as any;
        assertEquals(updatedMetadata['status'], types.uint(2)); // STATUS-PENDING
    },
});

// =============================================================================
// COMMIT 4: ACCESS CONTROL & ADVANCED FEATURES TEST SUITE
// Tests for access control system, system statistics, edge cases, and integration scenarios
// =============================================================================

Clarinet.test({
    name: "Access Control - Grant property access",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;

        // Register a property first
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Access Test Property"),
                types.ascii("Property for testing access control"),
                types.ascii("789 Access Street, Test City, TC"),
                types.ascii("Commercial"),
                types.uint(2000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);

        // Grant access to wallet2 (with access level and expiry)
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'grant-property-access', [
                types.uint(1),
                types.principal(wallet2.address),
                types.uint(2), // ACCESS-VERIFIER level
                types.some(types.uint(1000000)) // Expires at block 1000000
            ], wallet1.address)
        ]);

        block.receipts[0].result.expectOk().expectBool(true);

        // Verify access was granted using check-property-access
        let accessResult = chain.callReadOnlyFn('Deedchain', 'check-property-access', [
            types.uint(1),
            types.principal(wallet2.address),
            types.uint(2) // Required ACCESS-VERIFIER level
        ], wallet1.address);
        
        accessResult.result.expectOk().expectBool(true);
    },
});

Clarinet.test({
    name: "Access Control - Revoke property access",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;

        // Register property and grant access
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Revoke Test Property"),
                types.ascii("Property for testing access revocation"),
                types.ascii("101 Revoke Ave, Test City, TC"),
                types.ascii("Residential"),
                types.uint(1800),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'grant-property-access', [
                types.uint(1),
                types.principal(wallet2.address),
                types.uint(2), // ACCESS-VERIFIER level
                types.some(types.uint(1000000))
            ], wallet1.address)
        ]);

        // Revoke access
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'revoke-property-access', [
                types.uint(1),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);

        block.receipts[0].result.expectOk().expectBool(true);

        // Verify access was revoked - should fail with required level
        let accessResult = chain.callReadOnlyFn('Deedchain', 'check-property-access', [
            types.uint(1),
            types.principal(wallet2.address),
            types.uint(2) // Required ACCESS-VERIFIER level
        ], wallet1.address);
        
        accessResult.result.expectOk().expectBool(false);
    },
});

Clarinet.test({
    name: "Access Control - Unauthorized access grant attempt",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const wallet3 = accounts.get('wallet_3')!;

        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Unauthorized Test Property"),
                types.ascii("Property for testing unauthorized access"),
                types.ascii("404 Unauthorized St, Test City, TC"),
                types.ascii("Residential"),
                types.uint(1600),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);

        // Try to grant access from non-owner wallet
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'grant-property-access', [
                types.uint(1),
                types.principal(wallet3.address),
                types.uint(2), // ACCESS-VERIFIER level
                types.some(types.uint(1000000))
            ], wallet2.address) // wallet2 trying to grant access, but wallet1 is owner
        ]);

        block.receipts[0].result.expectErr().expectUint(1001); // ERR-UNAUTHORIZED
    },
});

Clarinet.test({
    name: "System Statistics - Get total properties count",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        // Initially should be 0
        let statsResult = chain.callReadOnlyFn('Deedchain', 'get-property-count', [], wallet1.address);
        statsResult.result.expectOk().expectUint(0);

        // Register three properties
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Stats Property 1"),
                types.ascii("First property for statistics testing"),
                types.ascii("100 Stats St, Test City, TC"),
                types.ascii("Residential"),
                types.uint(1500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Stats Property 2"),
                types.ascii("Second property for statistics testing"),
                types.ascii("200 Stats Ave, Test City, TC"),
                types.ascii("Commercial"),
                types.uint(3000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Stats Property 3"),
                types.ascii("Third property for statistics testing"),
                types.ascii("300 Stats Blvd, Test City, TC"),
                types.ascii("Industrial"),
                types.uint(5000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);

        // Should now be 3
        statsResult = chain.callReadOnlyFn('Deedchain', 'get-property-count', [], wallet1.address);
        statsResult.result.expectOk().expectUint(3);
    },
});

Clarinet.test({
    name: "Edge Cases - Property with maximum string lengths",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        // Test with maximum allowed string lengths
        const maxTitle = "A".repeat(100); // max title length
        const maxDescription = "B".repeat(500); // max description length  
        const maxLocation = "C".repeat(200); // max location length
        const maxPropertyType = "D".repeat(50); // max property type length
        const maxAreaUnit = "E".repeat(20); // max area unit length

        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii(maxTitle),
                types.ascii(maxDescription),
                types.ascii(maxLocation),
                types.ascii(maxPropertyType),
                types.uint(999999), // Large area
                types.ascii(maxAreaUnit),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);

        block.receipts[0].result.expectOk().expectUint(1);

        // Verify the property was registered correctly
        let propertyInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [
            types.uint(1)
        ], wallet1.address);

        const result = propertyInfo.result.expectOk().expectTuple() as any;
        const metadata = result['metadata'].expectTuple() as any;
        assertEquals(metadata['property-title'], types.ascii(maxTitle));
        assertEquals(metadata['total-area'], types.uint(999999));
    },
});

Clarinet.test({
    name: "Edge Cases - Multiple document additions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        // Register a property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Multi-Document Property"),
                types.ascii("Property for testing multiple documents"),
                types.ascii("555 Document Lane, Test City, TC"),
                types.ascii("Mixed Use"),
                types.uint(2500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);

        // Add multiple documents
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'add-property-document', [
                types.uint(1),
                types.ascii("Property Deed"),
                types.ascii("Legal Document"),
                types.ascii("deed123hash456"),
                types.ascii("Original property deed document")
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'add-property-document', [
                types.uint(1),
                types.ascii("Property Survey"),
                types.ascii("Survey Document"),
                types.ascii("survey789hash012"),
                types.ascii("Professional property survey")
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'add-property-document', [
                types.uint(1),
                types.ascii("Insurance Policy"),
                types.ascii("Insurance Document"),
                types.ascii("insurance345hash678"),
                types.ascii("Property insurance coverage details")
            ], wallet1.address)
        ]);

        // All should succeed
        block.receipts[0].result.expectOk().expectUint(1);
        block.receipts[1].result.expectOk().expectUint(2);
        block.receipts[2].result.expectOk().expectUint(3);

        // Verify different documents can be retrieved
        let doc1 = chain.callReadOnlyFn('Deedchain', 'get-property-document', [
            types.uint(1),
            types.uint(1)
        ], wallet1.address);
        
        let doc2 = chain.callReadOnlyFn('Deedchain', 'get-property-document', [
            types.uint(1),
            types.uint(2)
        ], wallet1.address);

        const doc1Info = doc1.result.expectOk().expectTuple() as any;
        const doc2Info = doc2.result.expectOk().expectTuple() as any;

        assertEquals(doc1Info['document-title'], types.ascii("Property Deed"));
        assertEquals(doc2Info['document-title'], types.ascii("Property Survey"));
    },
});

Clarinet.test({
    name: "Edge Cases - Status transition validation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        // Register a property (starts as STATUS-ACTIVE = 1)
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Status Test Property"),
                types.ascii("Property for testing status transitions"),
                types.ascii("777 Status Road, Test City, TC"),
                types.ascii("Residential"),
                types.uint(2200),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);

        // Test valid status transitions: 1 (Active) -> 2 (Pending)
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(2), // STATUS-PENDING
                types.ascii("Property under legal review")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // Test another valid transition: 2 (Pending) -> 3 (Suspended) 
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(3), // STATUS-SUSPENDED
                types.ascii("Property has been suspended")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // Test another valid transition: 3 (Suspended) -> 4 (Archived)
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(4), // STATUS-ARCHIVED
                types.ascii("Property has been archived")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // Test invalid transition: try to go from 4 (Archived) back to 1 (Active)
        // Archived is final state and cannot transition
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(1), // STATUS-ACTIVE
                types.ascii("Trying to reactivate archived property")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectErr().expectUint(1010); // ERR-INVALID-STATUS
    },
});

Clarinet.test({
    name: "Integration Test - Complete property lifecycle",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const wallet3 = accounts.get('wallet_3')!;

        // 1. Register property
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Lifecycle Property"),
                types.ascii("Property for complete lifecycle testing"),
                types.ascii("999 Lifecycle Drive, Test City, TC"),
                types.ascii("Luxury Residential"),
                types.uint(4000),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectUint(1);

        // 2. Add property document
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'add-property-document', [
                types.uint(1),
                types.ascii("Original Deed"),
                types.ascii("Legal"),
                types.ascii("lifecycle123hash"),
                types.ascii("Original property registration deed")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectUint(1);

        // 3. Grant access to potential buyer
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'grant-property-access', [
                types.uint(1),
                types.principal(wallet2.address),
                types.uint(2), // ACCESS-VERIFIER level
                types.some(types.uint(1000000))
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 4. Update metadata (price negotiation)
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'update-property-metadata', [
                types.uint(1),
                types.ascii("Lifecycle Property - REDUCED PRICE"),
                types.ascii("Property for complete lifecycle testing - Price reduced for quick sale"),
                types.ascii("999 Lifecycle Drive, Test City, TC"),
                types.ascii("Luxury Residential"),
                types.uint(4000),
                types.ascii("sqft")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 5. Change status to Pending
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(2), // STATUS-PENDING
                types.ascii("Buyer found, under legal review")
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 6. Verify property by authority
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'verify-property', [
                types.uint(1),
                types.ascii("Property verified by city assessor - all documentation complete")
            ], wallet3.address) // Different user acting as authority
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 7. Transfer property to new owner
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet2.address),
                types.ascii("Sale completed - transferred to new owner"),
                types.some(types.uint(450000)) // Sale price in micro-STX
            ], wallet1.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 8. New owner changes status to Suspended first
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(3), // STATUS-SUSPENDED
                types.ascii("Property under review after transfer")
            ], wallet2.address) // wallet2 is now the owner
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 9. Then change to Archived (valid transition from Suspended)
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'change-property-status', [
                types.uint(1),
                types.uint(4), // STATUS-ARCHIVED  
                types.ascii("Sale finalized and archived")
            ], wallet2.address)
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        // 10. Verify final state - check ownership
        let ownerResult = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet1.address);
        ownerResult.result.expectOk().expectPrincipal(wallet2.address);

        // 11. Verify property info reflects updates
        let propertyInfo = chain.callReadOnlyFn('Deedchain', 'get-property-info', [
            types.uint(1)
        ], wallet1.address);
        const result = propertyInfo.result.expectOk().expectTuple() as any;
        const metadata = result['metadata'].expectTuple() as any;
        assertEquals(metadata['property-title'], types.ascii("Lifecycle Property - REDUCED PRICE"));
        assertEquals(metadata['status'], types.uint(4)); // STATUS-ARCHIVED
    },
});

Clarinet.test({
    name: "Performance Test - Batch property operations",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;

        // Register multiple properties in single block
        let block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Batch Property 1"),
                types.ascii("Description for batch property number 1"),
                types.ascii("100 Batch Street, Test City, TC"),
                types.ascii("Batch Type"),
                types.uint(1100),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Batch Property 2"),
                types.ascii("Description for batch property number 2"),
                types.ascii("200 Batch Street, Test City, TC"),
                types.ascii("Batch Type"),
                types.uint(1200),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Batch Property 3"),
                types.ascii("Description for batch property number 3"),
                types.ascii("300 Batch Street, Test City, TC"),
                types.ascii("Batch Type"),
                types.uint(1300),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Batch Property 4"),
                types.ascii("Description for batch property number 4"),
                types.ascii("400 Batch Street, Test City, TC"),
                types.ascii("Batch Type"),
                types.uint(1400),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'register-property', [
                types.ascii("Batch Property 5"),
                types.ascii("Description for batch property number 5"),
                types.ascii("500 Batch Street, Test City, TC"),
                types.ascii("Batch Type"),
                types.uint(1500),
                types.ascii("sqft"),
                types.principal(wallet1.address)
            ], wallet1.address)
        ]);
        
        // All registrations should succeed
        for (let i = 0; i < 5; i++) {
            block.receipts[i].result.expectOk().expectUint(i + 1);
        }

        // Batch transfer some properties
        block = chain.mineBlock([
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(1),
                types.principal(wallet2.address),
                types.ascii("Batch transfer 1"),
                types.some(types.uint(100000))
            ], wallet1.address),
            Tx.contractCall('Deedchain', 'transfer-property', [
                types.uint(3),
                types.principal(wallet2.address),
                types.ascii("Batch transfer 2"),
                types.some(types.uint(150000))
            ], wallet1.address)
        ]);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);

        // Verify ownership changes
        let owner1 = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(1)
        ], wallet1.address);
        let owner3 = chain.callReadOnlyFn('Deedchain', 'get-property-owner-public', [
            types.uint(3)
        ], wallet1.address);

        owner1.result.expectOk().expectPrincipal(wallet2.address);
        owner3.result.expectOk().expectPrincipal(wallet2.address);

        // Verify total properties count
        let totalProps = chain.callReadOnlyFn('Deedchain', 'get-property-count', [], wallet1.address);
        totalProps.result.expectOk().expectUint(5);
    },
});
