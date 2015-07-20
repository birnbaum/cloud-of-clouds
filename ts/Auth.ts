///<reference path="References.ts" />

class Auth {

	private name: string;
	private privateKey: string;
    private group: boolean;
	
    constructor(name: string, privateKey: string, group: boolean) {
    	this.name = name;
    	this.privateKey = privateKey;
    	this.group = group;
    }

    getName(): string {
    	return this.name;
    }

    getPrivateKey(): string {
        return this.privateKey;
    }

    isGroup(): boolean {
        return this.group;
    }

    hasAccess(recipientList: string[]): boolean {
        for(var i = 0; i < recipientList.length; i++) {
            if(this.name == recipientList[i]) return true;
        }
        return false;
	}
}