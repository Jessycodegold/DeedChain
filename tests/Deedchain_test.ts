
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
