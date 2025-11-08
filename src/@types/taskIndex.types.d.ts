export interface TaskIndex {
    getValidRoles(): string[];
    getRoleVisual(role?: string): string;
    getValidSpheres(): string[];
    compareRoles(role1: string, role2: string): number;
}
