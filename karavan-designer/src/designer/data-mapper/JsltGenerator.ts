/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FieldDefinition, FieldMapping, SchemaData, ListMappingConfig } from './DataMapperTypes';
import { SchemaParser } from './SchemaParser';

export class JsltGenerator {
    
    /**
     * Generate JSLT spec from mappings and schemas
     */
    static generate(
        sourceSchema: SchemaData | undefined,
        targetSchema: SchemaData | undefined,
        mappings: FieldMapping[],
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        if (!sourceSchema || !targetSchema || mappings.length === 0) {
            return '// No mappings defined\n.';
        }

        // Debugging information
        // eslint-disable-next-line no-console
        console.log('[JsltGenerator] Generating JSLT', { mappingsCount: mappings.length, sourceFields: sourceSchema.fields.length, targetFields: targetSchema.fields.length });

        const sourceFields = SchemaParser.flattenFields(sourceSchema.fields);
        const targetFields = SchemaParser.flattenFields(targetSchema.fields);

        // Build the target structure
        const jslt = this.buildTargetStructure(targetFields, mappings, sourceFields, listMappingConfigs);
        // Log generated JSLT for debugging
        // eslint-disable-next-line no-console
        console.log('[JsltGenerator] Generated JSLT:\n' + jslt);
        const validation = this.validate(jslt);
        // eslint-disable-next-line no-console
        console.log('[JsltGenerator] Validation', validation);

        return jslt;
    }

    /**
     * Build the target JSON structure from mappings
     */
    private static buildTargetStructure(
        targetFields: FieldDefinition[],
        mappings: FieldMapping[],
        sourceFields: FieldDefinition[],
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        const rootFields = targetFields.filter(f => !f.parent);

        if (rootFields.length === 0) {
            return '.';
        }

        // Find which root fields have mappings under them
        const rootsWithMappings = rootFields.filter(root => {
            return mappings.some(m => {
                const target = targetFields.find(f => f.id === m.targetFieldId);
                return !!(target && target.path && target.path.startsWith(root.path || ''));
            });
        });

        // If no root field has mappings, build the full object mapping (all roots)
        if (rootsWithMappings.length === 0) {
            return this.buildObjectMapping(targetFields, mappings, sourceFields, '');
        }

        // If exactly one mapped root exists and it's an array, build array mapping for it
        if (rootsWithMappings.length === 1 && rootsWithMappings[0].type === 'array') {
            const arrayPath = rootsWithMappings[0].path || '';
            return this.buildArrayMapping(targetFields, mappings, sourceFields, arrayPath);
        }

        // Otherwise build a top-level object mapping including all mapped root properties
        return this.buildObjectMapping(targetFields, mappings, sourceFields, '');
    }

    /**
     * Build object mapping
     */
    private static buildObjectMapping(
        fields: FieldDefinition[],
        mappings: FieldMapping[],
        sourceFields: FieldDefinition[],
        pathPrefix: string,
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        // Debug: print context to help diagnose empty outputs
        // eslint-disable-next-line no-console
        console.log('[JsltGenerator] buildObjectMapping prefix=', pathPrefix, 'mappings=', mappings.map(m=>m.id));
        const lines: string[] = ['{'];
        const mappedFields = new Map<string, FieldDefinition>();

        // Determine direct children using parent links and optional pathPrefix
        const parentField = pathPrefix ? fields.find(f => f.path === pathPrefix) : undefined;
        // eslint-disable-next-line no-console
        console.log('[JsltGenerator] parentField=', parentField && { id: parentField.id, path: parentField.path, name: parentField.name });
        const parentId = parentField ? parentField.id : undefined;
        const directChildren = fields.filter(f => f.parent === parentId);
        // eslint-disable-next-line no-console
        console.log('[JsltGenerator] directChildren=', directChildren.map(d => ({ id: d.id, name: d.name, path: d.path })));

        // If the requested pathPrefix points to a field itself (no direct children), include mapping for that field
        if (parentField && directChildren.length === 0) {
            const parentMappings = mappings.filter(m => m.targetFieldId === parentField.id);
            if (parentMappings.length > 0) {
                const mapping = parentMappings[0];
                const mappingExpr = this.buildMappingExpression(mapping, sourceFields);

                if (parentField.isArray) {
                    // Attempt to build array mapping for this array field
                    const arrayExpr = this.buildArrayMapping(fields, mappings, sourceFields, parentField.path);
                    lines.push(`  "${parentField.name}": ${arrayExpr},`);
                } else if (parentField.type === 'object') {
                    // If the parent is an object but has no children, fall back to the mapping expression
                    lines.push(`  "${parentField.name}": ${mappingExpr},`);
                } else {
                    // Simple primitive field
                    lines.push(`  "${parentField.name}": ${mappingExpr},`);
                }
            }
        }

        directChildren.forEach(field => {
            const fieldMappings = mappings.filter(m => m.targetFieldId === field.id);
            
            if (fieldMappings.length > 0) {
                const mapping = fieldMappings[0];
                const mappingExpr = this.buildMappingExpression(mapping, sourceFields);
                
                if (field.isArray) {
                    // Handle array field - find item children by parent relation
                    const arrayChildren = fields.filter(f => f.parent === field.id);

                    if (arrayChildren.length > 0) {
                        // Array of objects: prefer explicit list mapping config when available
                        const cfg = listMappingConfigs.find(c => c.targetArrayPath === field.path);
                        const arrayExpr = cfg 
                            ? this.buildListToListMapping(cfg, sourceFields)
                            : this.buildArrayMapping(fields, mappings, sourceFields, field.path);
                        lines.push(`  "${field.name}": ${arrayExpr},`);
                    } else {
                        // Simple array
                        lines.push(`  "${field.name}": ${mappingExpr},`);
                    }
                } else if (field.type === 'object') {
                    // Nested object
                    const objExpr = this.buildObjectMapping(fields, mappings, sourceFields, field.path);
                    lines.push(`  "${field.name}": ${objExpr},`);
                } else {
                    // Simple field
                    lines.push(`  "${field.name}": ${mappingExpr},`);
                }
                
                mappedFields.set(field.name, field);
            }
        });

        // Remove trailing comma from last line
        if (lines.length > 1) {
            const lastIdx = lines.length - 1;
            lines[lastIdx] = lines[lastIdx].replace(/,\s*$/, '');
        }

        lines.push('}');
        return lines.join('\n');
    }

    /**
     * Build array mapping with for-loop or index access
     */
    private static buildArrayMapping(
        fields: FieldDefinition[],
        mappings: FieldMapping[],
        sourceFields: FieldDefinition[],
        arrayPath: string
    ): string {
        // If arrayPath is empty or falsy, fall back to object mapping
        if (!arrayPath || arrayPath.trim() === '') {
            return this.buildObjectMapping(fields, mappings, sourceFields, '');
        }

        // Normalize array path (strip trailing wildcard if present)
        const normalized = arrayPath.replace(/\/\*$/, '');

        // Find the array field by exact path or by type/containment as a fallback
        let arrayField = fields.find(f => f.path === arrayPath || f.path === normalized);
        if (!arrayField) {
            arrayField = fields.find(f => f.type === 'array' && (f.path === normalized || f.path.startsWith(normalized + '/')));
        }
        if (!arrayField) {
            arrayField = fields.find(f => f.type === 'array' && f.path.includes(normalized));
        }

        if (!arrayField) {
            return '[]';
        }

        // Determine all descendant fields under this array (items and deeper)
        const descendantFields = fields.filter(f => f.path !== arrayField.path && f.path.startsWith(normalized));

        if (descendantFields.length === 0) {
            return '[]';
        }

        // Determine mappings that target fields under this array (use normalized path)
        const childMappings = mappings.filter(m => {
            const targetField = fields.find(f => f.id === m.targetFieldId);
            return targetField && targetField.path.startsWith(normalized);
        });

        if (childMappings.length === 0) {
            return '[]';
        }

        // Find the item node (the child whose parent is the array field)
        let itemNode = fields.find(f => f.parent === arrayField!.id);
        if (!itemNode) {
            // fallback heuristics: look for a descendant with a wildcard or 'items' in the path
            itemNode = descendantFields.find(f => f.path === `${normalized}/*`) || descendantFields.find(f => f.path.includes(`${normalized}/items`)) || descendantFields.find(f => f.path.includes('*')) || descendantFields[0];
        }

        const itemNodePath = itemNode ? itemNode.path : normalized;

        // If item node or its descendants contain objects, build array of objects using the item node as the root
        const itemDescendants = fields.filter(f => f.path !== itemNodePath && f.path.startsWith(itemNodePath));
        if (itemDescendants.some(f => f.type === 'object')) {
            const inner = this.buildObjectMapping(fields, mappings, sourceFields, itemNodePath);
            return `[for (${this.getJsltPath(normalized)}) ${inner}]`;
        }

        // Otherwise treat as simple array of values: pick the first mapping expression that maps into this array
        const mapping = childMappings[0];
        const expr = this.buildMappingExpression(mapping, sourceFields);
        return `[for (${this.getJsltPath(normalized)}) ${expr}]`;
    }

    /**
     * Build mapping expression for a single field
     */
    private static buildMappingExpression(mapping: FieldMapping, sourceFields: FieldDefinition[]): string {
        if (mapping.multiSourceExpression) {
            // Multi-source concatenation
            return this.buildMultiSourceExpression(mapping, sourceFields);
        }

        const sourceField = sourceFields.find(f => f.id === mapping.sourceFieldIds[0]);
        if (!sourceField) {
            return 'null';
        }

        let expr = this.getJsltPath(sourceField.path);

        // Arrays now use direct path access without index selectors in simplified UI
        // The path already includes proper array notation from SchemaParser

        // Apply transformation if specified
        if (mapping.transformation) {
            expr = this.applyTransformation(expr, mapping.transformation);
        }

        return expr;
    }

    /**
     * Build multi-source expression (concatenation)
     */
    private static buildMultiSourceExpression(mapping: FieldMapping, sourceFields: FieldDefinition[]): string {
        if (!mapping.multiSourceExpression) {
            return 'null';
        }

        let expr = mapping.multiSourceExpression;
        
        // Replace source field placeholders with JSLT paths
        mapping.sourceFieldIds.forEach((sourceId, index) => {
            const sourceField = sourceFields.find(f => f.id === sourceId);
            if (sourceField) {
                const jsltPath = this.getJsltPath(sourceField.path);
                const placeholder = `source${index + 1}`;
                expr = expr.replace(new RegExp(placeholder, 'g'), jsltPath);
            }
        });

        return expr;
    }

    /**
     * Apply JSLT transformation function
     */
    private static applyTransformation(expr: string, transformation: { name: string; parameters?: string[] }): string {
        const { name, parameters = [] } = transformation;
        
        if (parameters.length > 0) {
            const params = parameters.map(p => `"${p}"`).join(', ');
            return `${name}(${expr}, ${params})`;
        } else {
            return `${name}(${expr})`;
        }
    }

    /**
     * Convert field path to JSLT path
     */
    private static getJsltPath(fieldPath: string): string {
        if (!fieldPath || fieldPath === '') {
            return '.';
        }

        // Support both dot-based paths and JSON Pointer style paths starting with '/'
        if (fieldPath.startsWith('/')) {
            const parts = fieldPath.split('/').filter(p => p !== '');
            if (parts.length === 0) return '.';
            // Keep '*' wildcard for array items
            const jslt = parts.map(p => p === '*' ? '*' : p).map(p => `.${p}`).join('');
            return jslt || '.';
        }

        // Fallback: dot-based path
        const path = fieldPath
            .replace(/\[\]/g, '')  // Remove array brackets for now
            .split('.')
            .filter(p => p)
            .map(p => `.${p}`)
            .join('');

        return path || '.';
    }

    /**
     * Get variable name for array item in for-loop
     */
    private static getArrayItemVariable(fieldPath: string): string {
        const raw = fieldPath.startsWith('/') ? fieldPath.split('/').filter(p => p !== '') : fieldPath.replace(/\[\]/g, '').split('.');
        const parts = raw.filter((p: string) => p && p !== 'items' && p !== '*');
        const lastPart = parts[parts.length - 1] || 'item';
        return lastPart;
    }

    /**
     * Validate generated JSLT
     */
    static validate(jslt: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Basic syntax validation
        if (!jslt || jslt.trim() === '') {
            errors.push('JSLT spec is empty');
        }

        // Check balanced braces
        const openBraces = (jslt.match(/{/g) || []).length;
        const closeBraces = (jslt.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push('Unbalanced curly braces');
        }

        // Check balanced brackets
        const openBrackets = (jslt.match(/\[/g) || []).length;
        const closeBrackets = (jslt.match(/]/g) || []).length;
        if (openBrackets !== closeBrackets) {
            errors.push('Unbalanced square brackets');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Build list-to-list mapping using ListMappingConfig
     */
    private static buildListToListMapping(config: ListMappingConfig, sourceFields: FieldDefinition[]): string {
        const sourceArrayPath = this.getJsltPath(config.sourceArrayPath);

        // If targetArrayPath points to a simple array (not objects), allow projection
        const isProjection = config.fieldMappings.length === 1;

        if (isProjection) {
            const expr = this.buildMappingExpression(config.fieldMappings[0], sourceFields)
                .replace(this.getJsltPath(config.sourceArrayPath), '.');
            return `[for (${sourceArrayPath}) ${expr}]`;
        }

        // Build the inner object mapping using the field mappings from the config
        const fieldMappingLines: string[] = [];

        for (const mapping of config.fieldMappings) {
            const sourceExpression = this.buildMappingExpression(mapping, sourceFields);
            const innerExpr = sourceExpression.replace(this.getJsltPath(config.sourceArrayPath), '.');
            // mapping.targetFieldId is an id; we need a name. For now, assume we format with a generic key; in full impl, look up target field name by id.
            fieldMappingLines.push(`  "${mapping.targetFieldId}": ${innerExpr}`);
        }

        const objectMapping = `{\n${fieldMappingLines.join(',\n')}\n}`;
        return `[for (${sourceArrayPath}) ${objectMapping}]`;
    }
}
