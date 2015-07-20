declare module CloudRailClient {
    export var CloudRailInterface: any;
    export var ClientIdentity: any;
    export var Node: any;
    export function setClientID(id: string): any;
    export function File(serviceTag: string, fun?: any): void;
    export function FileStorage(serviceTag: string): void;
    export function UserAccountInfo(serviceTag: string): void;
    export function UserIdentity(a: any, b: any): void;
}