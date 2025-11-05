# Task: Add Constant Values and Custom Target Fields to Data Mapper

## Context
- Project: camel-karavan
- Directory: `karavan-designer/src/designer/data-mapper`
- Current Branch: `data-mapper-poc`
- Purpose: Enhance the Data Mapper with functionality to add constant values and custom target fields.

## Steps
1. **Update Types**:
   - Add `ConstantValue` interface to `DataMapperTypes.ts`.
   - Extend `FieldDefinition` with `isCustom` flag for user-added fields.
   - Add `constantSourceIds` to `FieldMapping` for tracking constant sources.

2. **Update Store**:
   - Add `constants` and `customTargetFields` to `DataMapperStore.ts`.
   - Implement actions: `addConstant`, `removeConstant`, `addCustomTargetField`, `removeCustomTargetField`.

3. **Create Modals**:
   - Create `AddConstantModal.tsx` for adding constant values.
   - Create `AddTargetFieldModal.tsx` for adding custom target fields.

4. **Update ReactFlowDataMapper**:
   - Add buttons to the toolbar for opening modals.
   - Integrate constants and custom fields into node generation logic.

5. **Style Updates**:
   - Update `data-mapper.css` for compact and professional field node styling.

## Expected Outcome
- Users can add constant values and custom target fields via modals.
- Constants appear as source nodes; custom fields appear as target nodes.
- Both constants and custom fields can be mapped and deleted.

## Additional Notes
- Ensure consistent styling and hover effects for new nodes.
- Validate inputs in modals to prevent empty or invalid entries.