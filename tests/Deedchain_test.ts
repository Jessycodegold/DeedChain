
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
