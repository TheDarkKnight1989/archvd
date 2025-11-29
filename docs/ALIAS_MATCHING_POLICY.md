# Alias SKU Matching Policy

**Last Updated:** 2025-11-25
**Status:** SUGGEST-ONLY MODE

---

## ⚠️ Important: No Auto-Mapping

The Alias SKU matching service is configured to be **suggest-only**. This means:

### ❌ What It Does NOT Do

- ❌ Does NOT automatically write to `inventory_alias_links`
- ❌ Does NOT create database entries without approval
- ❌ Does NOT persist matches, even at 100% confidence
- ❌ Does NOT run background jobs for bulk linking
- ❌ Does NOT execute any automatic mapping operations

### ✅ What It DOES Do

- ✅ Analyzes SKU and product name for potential matches
- ✅ Returns suggestions with confidence scores (0.0 - 1.0)
- ✅ Provides catalog item details for review
- ✅ Offers multiple match candidates when available
- ✅ Calculates similarity using Levenshtein distance

---

## Match Confidence Levels

The matching service returns a confidence score for each suggestion:

| Confidence | Method | Description |
|------------|--------|-------------|
| **1.0** | Exact SKU | Perfect SKU match (case-insensitive) |
| **0.95** | Normalized SKU | Match after removing spaces/dashes |
| **0.85** | SKU Search | Best result from SKU search (adjusted by similarity) |
| **0.70** | Name Search | Match via product name search (adjusted by similarity) |
| **0.0** | No Match | No suitable matches found - manual search required |

---

## Usage Pattern

### 1. Get Match Suggestion

```typescript
import { createAliasClient, matchInventoryToAliasCatalog } from '@/lib/services/alias';

const client = createAliasClient();
const suggestion = await matchInventoryToAliasCatalog(client, {
  sku: "HQ7978 100",
  productName: "Air Jordan 5 Retro Grape",
  brand: "Air Jordan"
});

// Suggestion contains:
// - catalogId: "air-jordan-5-retro-grape-2025-hq7978-100"
// - confidence: 1.0
// - catalogItem: { full catalog details }
// - matchMethod: "exact_sku"
```

### 2. Present to User for Approval

**UI should display:**
- ✅ Suggested match details (name, SKU, brand)
- ✅ Confidence score and match method
- ✅ Side-by-side comparison with inventory item
- ✅ "Accept" and "Reject" buttons
- ✅ Option to search manually if rejected

### 3. Manual Approval Required

**Only after user clicks "Accept":**
```typescript
// Example (to be implemented in future phase)
const approved = await userApprovesMatch(suggestion);

if (approved) {
  // THEN and ONLY THEN create the link
  await createInventoryAliasLink({
    inventory_id: inventoryItem.id,
    alias_catalog_id: suggestion.catalogId,
    match_confidence: suggestion.confidence,
    mapping_status: 'ok',
  });
}
```

---

## Deprecated Functions

The following functions are deprecated and should not be used:

### `shouldAutoMap(result)` ❌ DEPRECATED
**Reason:** Auto-mapping is disabled
**Replacement:** Use `isHighConfidenceMatch()` for UI indication only
**Behavior:** Always returns `false`

### `getAutoMapThreshold()` ❌ DEPRECATED
**Reason:** Auto-mapping is disabled
**Replacement:** Use `getConfidenceThreshold()` for reference
**Behavior:** Logs warning, returns threshold value

---

## Security & Safety

**Why suggest-only?**

1. **Prevent Incorrect Mappings:** SKU matching isn't 100% perfect across platforms
2. **User Control:** Let users verify before committing to a mapping
3. **Data Integrity:** Avoid polluting the database with incorrect links
4. **Reversibility:** Manual approval allows users to reject bad suggestions
5. **Auditability:** User explicitly confirms each mapping

---

## Future Phases

**Potential features (pending approval):**

- 🔄 Bulk suggestion review UI
- 📊 Confidence score tuning based on user feedback
- 🤖 Machine learning improvements from accepted/rejected patterns
- ⚡ Quick-accept for exact SKU matches with additional validation

**All require explicit user approval before implementation.**

---

## Implementation Checklist

When building features that use matching:

- [ ] Never call database writes automatically
- [ ] Always present suggestions to user first
- [ ] Require explicit user action (button click)
- [ ] Show confidence score and match method
- [ ] Allow user to reject and search manually
- [ ] Log user decisions for future improvements
- [ ] Validate all user inputs before persisting

---

## Example: Correct Usage

```typescript
// ✅ CORRECT: Suggest-only
async function suggestAliasMatch(inventoryId: string) {
  const inventory = await getInventoryItem(inventoryId);
  const client = createAliasClient();

  const suggestion = await matchInventoryToAliasCatalog(client, {
    sku: inventory.sku,
    productName: inventory.productName,
    brand: inventory.brand,
  });

  // Return suggestion to UI
  return {
    suggestion,
    requiresApproval: true,
  };
}

// ❌ INCORRECT: Auto-mapping
async function autoMapInventoryToAlias(inventoryId: string) {
  const suggestion = await matchInventoryToAliasCatalog(...);

  if (shouldAutoMap(suggestion)) { // ❌ NEVER DO THIS
    await createInventoryAliasLink(...); // ❌ NO AUTO-WRITE
  }
}
```

---

**Status:** Enforced
**Next Review:** Before Week 3 implementation
