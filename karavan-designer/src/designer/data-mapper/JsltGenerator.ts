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

        // If exactly one mapped root exists and it's an array, build an object containing that array
        if (rootsWithMappings.length === 1 && rootsWithMappings[0].type === 'array') {
            const arrayRootPath = rootsWithMappings[0].path || '';
            // Build object mapping starting from this root path so the property name is included
            return this.buildObjectMapping(targetFields, mappings, sourceFields, arrayRootPath, undefined, listMappingConfigs);
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
        baseIterator?: string,
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

        // Special case: when pathPrefix points to an array root, emit that array property
        if (parentField && parentField.type === 'array') {
            const hasDescendantMappings = mappings.some(m => {
                const tf = fields.find(f => f.id === m.targetFieldId);
                return tf && tf.path && parentField.path && tf.path.startsWith(parentField.path);
            });
            if (hasDescendantMappings) {
                const arrayExpr = this.buildArrayMapping(fields, mappings, sourceFields, parentField.path || '', listMappingConfigs);
                lines.push(`  "${parentField.name}": ${arrayExpr},`);
            }
        }

        // If the requested pathPrefix points to a field itself (no direct children), include mapping for that field
        if (parentField && directChildren.length === 0) {
            const parentMappings = mappings.filter(m => m.targetFieldId === parentField.id);
            if (parentMappings.length > 0) {
                const mapping = parentMappings[0];
                const mappingExpr = this.buildMappingExpression(mapping, sourceFields, baseIterator);

                if (parentField.isArray) {
                    // Only include array if there are mappings targeting its descendants
                    const hasDescendantMappings = mappings.some(m => {
                        const tf = fields.find(f => f.id === m.targetFieldId);
                        return tf && tf.path && parentField.path && tf.path.startsWith(parentField.path);
                    });
                    if (hasDescendantMappings) {
                        const arrayExpr = this.buildArrayMapping(fields, mappings, sourceFields, parentField.path);
                        lines.push(`  "${parentField.name}": ${arrayExpr},`);
                    }
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
                const mappingExpr = this.buildMappingExpression(mapping, sourceFields, baseIterator);
                
                if (field.isArray) {
                    // Include array only when there are mappings targeting its descendants
                    const hasDescendantMappings = mappings.some(m => {
                        const tf = fields.find(f => f.id === m.targetFieldId);
                        return tf && tf.path && field.path && tf.path.startsWith(field.path);
                    });
                    if (hasDescendantMappings) {
                        // Handle array field - find item children by parent relation
                        const arrayChildren = fields.filter(f => f.parent === field.id);
                        if (arrayChildren.length > 0) {
                            // Array of objects
                            const arrayExpr = this.buildArrayMapping(fields, mappings, sourceFields, field.path);
                            lines.push(`  "${field.name}": ${arrayExpr},`);
                        } else {
                            // Primitive array; mappingExpr must be provided via transformation/index etc.
                            lines.push(`  "${field.name}": ${mappingExpr},`);
                        }
                    }
                } else if (field.type === 'object') {
                    // Nested object
                    const objExpr = this.buildObjectMapping(fields, mappings, sourceFields, field.path, baseIterator);
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
        arrayPath: string,
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        // If arrayPath is empty or falsy, fall back to object mapping
        if (!arrayPath || arrayPath.trim() === '') {
            return this.buildObjectMapping(fields, mappings, sourceFields, '', undefined, listMappingConfigs);
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

        // Prefer list-mapping config if exists for this target array
        const listConfig = listMappingConfigs.find(c => c.targetArrayPath === normalized);
        // Determine mappings that target fields under this array (use normalized path)
        const childMappings = (listConfig?.fieldMappings && listConfig.fieldMappings.length > 0)
            ? listConfig.fieldMappings
            : mappings.filter(m => {
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

        // Choose iterator: use listConfig sourceArrayPath when provided, otherwise nearest array ancestor
        let iteratorArrayPath: string | undefined;
        if (listConfig?.sourceArrayPath) {
            iteratorArrayPath = listConfig.sourceArrayPath;
        } else {
            const primaryMapping = childMappings[0];
            const primarySource = sourceFields.find(f => f.id === primaryMapping.sourceFieldIds[0]);
            iteratorArrayPath = primarySource ? (this.getNearestArrayAncestorPath(primarySource.path, sourceFields)) : undefined;
        }
        const hasIterator = !!iteratorArrayPath;
        const iteratorJsltPath = hasIterator ? this.getJsltPath(iteratorArrayPath!) : '';

        // If item node or its descendants contain objects, build array of objects using the item node as the root
        const itemDescendants = fields.filter(f => f.path !== itemNodePath && f.path.startsWith(itemNodePath));
        if (itemDescendants.some(f => f.type === 'object')) {
            // Object array target
            if (listConfig?.operation === 'index-access' && listConfig.sourceArrayPath) {
                // Build single element mapped from indexed source
                const indexBase = this.getIndexBase(listConfig);
                const inner = this.buildObjectMapping(fields, mappings, sourceFields, itemNodePath, indexBase, listMappingConfigs);
                return `[ ${inner} ]`;
            }
            const inner = this.buildObjectMapping(fields, mappings, sourceFields, itemNodePath, iteratorArrayPath, listMappingConfigs);
            if (hasIterator && iteratorJsltPath) {
                return `[for (${iteratorJsltPath}) ${inner}]`;
            } else {
                // No iterator found on source; emit single object array element
                return `[ ${inner} ]`;
            }
        }

        // Otherwise treat as simple array of values: pick the first mapping expression that maps into this array
        const mapping = childMappings[0];
        if (listConfig?.operation === 'index-access' && listConfig.sourceArrayPath) {
            const indexBase = this.getIndexBase(listConfig);
            const expr = this.buildMappingExpression(mapping, sourceFields, indexBase);
            return `[ ${expr} ]`;
        }
        const expr = this.buildMappingExpression(mapping, sourceFields, iteratorArrayPath);
        if (hasIterator && iteratorJsltPath) {
            return `[for (${iteratorJsltPath}) ${expr}]`;
        } else {
            // No iterator found; wrap single value in array
            return `[ ${expr} ]`;
        }
    }

    /**
     * Build mapping expression for a single field
     */
    private static buildMappingExpression(mapping: FieldMapping, sourceFields: FieldDefinition[], baseIterator?: string): string {
        // If we have a multi-source expression, build it first and then allow transformation application below
        if (mapping.multiSourceExpression) {
            let expr = this.buildMultiSourceExpression(mapping, sourceFields, baseIterator);
            if (mapping.transformation) {
                expr = this.applyTransformation(expr, mapping.transformation);
            }
            return expr;
        }

        const sourceField = sourceFields.find(f => f.id === mapping.sourceFieldIds[0]);
        if (!sourceField) {
            return 'null';
        }

        let expr = this.getJsltPath(sourceField.path);

        // If inside an iterator, relativize the expression against it
        if (baseIterator) {
            const iterJslt = this.getJsltPath(baseIterator);
            expr = this.relativize(expr, iterJslt);
            // Normalize leftover wildcard/item segments when inside an iterator
            // JSLT does not use '*' in path; inside for-loop current item is '.'
            // Drop leading '.items.*.' or '.*.' after relativization
            expr = this.normalizeItemExpression(expr);
        }

        // If mapping requests an explicit index selector (array -> non-array mapping), insert index access
        if (mapping.indexSelector) {
            const iteratorArrayPath = this.getNearestArrayAncestorPath(sourceField.path, sourceFields);
            // determine index expression
            let indexExpr = '0';
            if (mapping.indexSelector === 'first' || !mapping.indexSelector) {
                indexExpr = '0';
            } else if (mapping.indexSelector === 'last') {
                // use size(array) - 1
                if (iteratorArrayPath) {
                    const itJslt = this.getJsltPath(iteratorArrayPath);
                    indexExpr = `size(${itJslt}) - 1`;
                } else {
                    indexExpr = '0';
                }
            } else if (mapping.indexSelector === 'custom' && typeof mapping.indexValue === 'number') {
                indexExpr = String(mapping.indexValue);
            } else {
                indexExpr = String(mapping.indexSelector);
            }

            if (iteratorArrayPath) {
                const itJslt = this.getJsltPath(iteratorArrayPath);
                // If expr begins with the iterator, insert [index] after it
                if (expr.startsWith(itJslt)) {
                    expr = `${itJslt}[${indexExpr}]${expr.slice(itJslt.length)}`;
                } else {
                    // Try replacing first occurrence
                    const replaced = expr.replace(itJslt, `${itJslt}[${indexExpr}]`);
                    if (replaced === expr) {
                        // Fallback: append index to whole expr
                        expr = `${expr}[${indexExpr}]`;
                    } else {
                        expr = replaced;
                    }
                }
            } else {
                // No iterator found; fallback to appending index selector
                expr = `${expr}[${indexExpr}]`;
            }
        }

        // If an array-oriented transformation is requested and the source is under an array,
        // wrap the expression in a for-loop to build an array for the function (unless indexSelector is set)
        const arrayFuncs = new Set(['sum','min','max','size','flatten','reverse','sort','unique','join']);
        if (mapping.transformation && arrayFuncs.has(mapping.transformation.name) && !baseIterator && mapping.indexSelector === undefined) {
            const iteratorArrayPath = this.getNearestArrayAncestorPath(sourceField.path, sourceFields);
            if (iteratorArrayPath) {
                const iteratorJslt = this.getJsltPath(iteratorArrayPath);
                const rel = this.relativize(expr, iteratorJslt);
                const relNorm = this.normalizeItemExpression(rel);
                expr = `[for (${iteratorJslt}) ${relNorm}]`;
            }
        }

        // Apply transformation if specified
        if (mapping.transformation) {
            expr = this.applyTransformation(expr, mapping.transformation);
        }

        return expr;
    }

    /** Normalize expressions relative to current array item (remove '.items.*.' or '.*.' prefixes) */
    private static normalizeItemExpression(expr: string): string {
        // Remove leading '.items.*.'
        expr = expr.replace(/^\.items\.\*\./, '.');
        // Remove any leading '.*.'
        expr = expr.replace(/^\.\*\./, '.');
        // If the expression is just '.*', treat as current item '.'
        if (expr === '.*') return '.';
        // Also collapse any accidental '..' that might result
        expr = expr.replace(/\.\.+/g, '.');
        return expr;
    }

    /**
     * Build multi-source expression (concatenation)
     */
    private static buildMultiSourceExpression(mapping: FieldMapping, sourceFields: FieldDefinition[], baseIterator?: string): string {
        if (!mapping.multiSourceExpression) {
            return 'null';
        }

        let expr = mapping.multiSourceExpression;
        
        // Replace source field placeholders with JSLT paths
        mapping.sourceFieldIds.forEach((sourceId, index) => {
            const sourceField = sourceFields.find(f => f.id === sourceId);
            if (sourceField) {
                let jsltPath = this.getJsltPath(sourceField.path);
                if (baseIterator) {
                    const iterJslt = this.getJsltPath(baseIterator);
                    jsltPath = this.relativize(jsltPath, iterJslt);
                    jsltPath = this.normalizeItemExpression(jsltPath);
                }
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
        // Special handling for index access pseudo-function
        if (name === 'index') {
            const selRaw = parameters[0] || '0';
            let indexExpr = '0';
            if (selRaw === 'first') {
                indexExpr = '0';
            } else if (selRaw === 'last') {
                indexExpr = `size(${expr}) - 1`;
            } else {
                indexExpr = selRaw;
            }
            return `${expr}[${indexExpr}]`;
        }
        
        if (parameters.length > 0) {
            const params = parameters.map(p => `"${p}"`).join(', ');
            return `${name}(${expr}, ${params})`;
        } else {
            return `${name}(${expr})`;
        }
    }

    /** Convert ListMappingConfig index selection into a base iterator path for relativization */
    private static getIndexBase(config: ListMappingConfig): string | undefined {
        if (!config.sourceArrayPath) return undefined;
        const base = this.getJsltPath(config.sourceArrayPath);
        const sel = config.indexSelector;
        if (sel === 'first' || !sel) return `${config.sourceArrayPath}`; // baseIterator will relativize; index applied in expression if needed
        if (sel === 'last') {
            // We can't easily use size() inside base; instead return same base and rely on per-field index transform if needed
            return `${config.sourceArrayPath}`;
        }
        if (sel === 'custom' && typeof config.indexValue === 'number') {
            // Construct a pseudo-path by appending [index] to base; relativization will treat it as part of base
            return `${config.sourceArrayPath}`;
        }
        return `${config.sourceArrayPath}`;
    }

    /**
     * Relativize an absolute JSLT path against an iterator path used in a for-loop
     */
    private static relativize(expr: string, iteratorJslt: string): string {
        // If expression equals iterator, current item is '.'
        if (expr === iteratorJslt) {
            return '.';
        }

        // Normalize iterator to ensure it has trailing dot for direct child matching
        const iterWithDot = iteratorJslt.endsWith('.') ? iteratorJslt : `${iteratorJslt}.`;

        // Case 1: Expression begins with iterator + '.*.' (array item wildcard segment)
        // Example: expr '.order.items.*.sku' with iterator '.order.items' -> '.sku'
        const wildcardPrefix = `${iterWithDot}*.`;
        if (expr.startsWith(wildcardPrefix)) {
            return `.${expr.slice(wildcardPrefix.length)}`;
        }

        // Case 2: Expression begins with iterator + '.' (simple descendant access)
        // Example: expr '.order.items.sku' with iterator '.order.items' -> '.sku'
        if (expr.startsWith(iterWithDot)) {
            return `.${expr.slice(iterWithDot.length)}`;
        }

        // Fallback: leave as-is
        return expr;
    }

    /**
     * Find nearest array ancestor path for a given field path in a schema
     */
    private static getNearestArrayAncestorPath(fieldPath: string, fields: FieldDefinition[]): string | undefined {
        const current = fields.find(f => f.path === fieldPath);
        if (!current) return undefined;
        let node: FieldDefinition | undefined = current;
        while (node && node.parent) {
            const parent = fields.find(f => f.id === node!.parent);
            if (!parent) break;
            if (parent.type === 'array') {
                return parent.path || undefined;
            }
            node = parent;
        }
        return undefined;
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
            // Drop wildcard '*' segments; JSLT uses '.' for current item inside loops
            const parts = fieldPath.split('/').filter(p => p !== '' && p !== '*');
            if (parts.length === 0) return '.';
            let jslt = parts.map(p => `.${p}`).join('');
            // Collapse accidental duplicate '.items.items'
            jslt = jslt.replace(/\.items\.items/g, '.items');
            // Collapse any duplicate dots
            jslt = jslt.replace(/\.\.+/g, '.');
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
        
        // Build the inner object mapping using the field mappings from the config
        const fieldMappingLines: string[] = [];
        
        for (const mapping of config.fieldMappings) {
            const sourceField = sourceFields.find(f => f.id === mapping.sourceFieldIds[0]);
            if (sourceField) {
                // Get the field name without the array path prefix
                const targetFieldName = mapping.targetFieldId.split('.').pop() || mapping.targetFieldId;
                const sourceExpression = this.buildMappingExpression(mapping, sourceFields);
                
                // Replace the array path with current item reference
                const itemExpression = sourceExpression.replace(
                    this.getJsltPath(config.sourceArrayPath),
                    '.'
                );
                
                fieldMappingLines.push(`  "${targetFieldName}": ${itemExpression}`);
            }
        }
        
        if (fieldMappingLines.length === 0) {
            return `[for (${sourceArrayPath}) .]`;
        }
        
        const objectMapping = `{\n${fieldMappingLines.join(',\n')}\n}`;
        return `[for (${sourceArrayPath}) ${objectMapping}]`;
    }
}
