declare module secrets {
    export function random(bits: number): string;
    export function share(secret: string, numShares: number, threshold: number, padLength?: number, withoutPrefix?: any): any[];
    export function combine(shares: any[]): any;
}