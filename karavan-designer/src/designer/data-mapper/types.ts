export type MappingKind = "source" | "constant";

export interface MappingDescriptor {
    targetPath: string[];
    kind: MappingKind;
    sourcePath?: string[];
    constantId?: string;
}

export interface ConstantEntry {
    id: string;
    name: string;
    value: string;
}
