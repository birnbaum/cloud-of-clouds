///<reference path="References.ts" />

class SecurityManager {

	private controller: Controller;
	private auths: Auth[];
	private keys;

	constructor(controller: Controller) {
		this.controller = controller;
        this.keys = "";
	}

    /**
     * Authenticates and authorizes the user. Returns the names of all accessable groups.
     */
	login(name: string, password: string): string[] {
        var encryptedPrivateKey = this.keys.privateKeys[name];
        if(encryptedPrivateKey) {
            var privateKey = CryptoJS.AES.decrypt(JSON.stringify(encryptedPrivateKey), password, {format: Util.JsonFormatter}).toString(CryptoJS.enc.Latin1);
            if (privateKey.substring(0, 31) != "-----BEGIN RSA PRIVATE KEY-----") {
                alert("Wrong Password");
            } else {
                console.info("Login successful");
            }

            var auth: Auth = new Auth(name, privateKey, false),
                groups = this.extractGroups();
            this.auths = this.getAllAuths(auth, groups);
        }
        return this.getAllAuthGroupNames();
	}

    /**
     * Extracts all non empty groups from the keys structure
     */
    private extractGroups(): Object {
        var groups = {};
        for (var element in this.keys.privateKeys) {
            if (!this.keys.privateKeys.hasOwnProperty(element) ||
                this.keys.privateKeys[element].hasOwnProperty('ct') ||
                Object.keys(this.keys.privateKeys[element]).length === 0) {
                continue;
            }
            groups[element] = this.keys.privateKeys[element];
        }
        return groups;
    }

    private getAllAuths(userAuth: Auth, allGroups): Auth[] {
        var allAuths = [],
            remainingGroups = allGroups,
            authStack = [userAuth];

        while(authStack.length > 0) {
            var auth = authStack.shift();
            for (var group in remainingGroups) {
                if(typeof remainingGroups[group][auth.getName()] !== 'undefined') {
                    var newAuth = this.createAuth(auth, group, remainingGroups[group]);
                    delete remainingGroups[group];
                    authStack.push(newAuth);
                }
            }
            allAuths.push(auth);
        }
        return allAuths;
    }

    private createAuth(childAuth: Auth, groupName: string, group: Object): Auth {
        var encryptedGroupPrivateKey = group[childAuth.getName()];

        var encryptedSymmetricKey = encryptedGroupPrivateKey.encryptedSymmetricKey,
            encryptedPrivateKey = encryptedGroupPrivateKey.encryptedPrivateKey;

        var decrypter = new JSEncrypt();
        decrypter.setPrivateKey(childAuth.getPrivateKey());
        var symmetricKey = decrypter.decrypt(encryptedSymmetricKey);

        var groupPrivateKey = CryptoJS.AES.decrypt(JSON.stringify(encryptedPrivateKey), symmetricKey, { format: Util.JsonFormatter }).toString(CryptoJS.enc.Latin1);

        return new Auth(groupName, groupPrivateKey, true);
    }

    combineAndDecrypt(files, shares, isBenchmarkTest: boolean = false): string {
        if(!isBenchmarkTest) console.time("combine and decrypt");
        var key = this.reconstructKey(shares),
            file = files[0], // no errasure coding, all files are the same -> taking first result
            decrypted = CryptoJS.AES.decrypt(JSON.stringify(file), key, { format: Util.JsonFormatter }).toString(CryptoJS.enc.Latin1);
        if(!isBenchmarkTest) console.timeEnd("combine and decrypt");

        return decrypted;
    }

    encryptAndSplit(file, recipients: string[], isBenchmarkTest: boolean = false) {
        if(!isBenchmarkTest) console.time("encrypt and split");

		var reader = new FileReader(),
			amountOfShares = this.controller.getTotalCloudCount();
		
		return $.Deferred((deferred) => {
            reader.onload = (e) => {
                var data = reader.result,
                    key = secrets.random(256),
                    encrypted = CryptoJS.AES.encrypt(data, key, { format: Util.JsonFormatter }),
                    shares = this.createShares(key, amountOfShares, recipients),
                    filesArray = [],
                    sharesArray = [];

                for(var i = 0; i < amountOfShares; i++) {
                    filesArray.push(encrypted);
                    sharesArray.push(shares[i]);
                }

                if(!isBenchmarkTest) console.timeEnd("encrypt and split");
                deferred.resolve([filesArray, sharesArray]);
            }
            reader.readAsDataURL(file);
        }).promise();
	}

    setKeys(keys) {
        this.keys = keys;
    }

    hasAccessToFile(namelist: string[]): boolean {
        if(namelist.length == 0) {
            return true;
        } else if(typeof this.auths === 'undefined') {
            return false;
        } else {
            for(var i = 0; i < this.auths.length; i++) {
                if(namelist.indexOf(this.auths[i].getName()) > -1) return true;
            }
            return false;
        }
    }

    getAllAccountAndGroupNames(): string[] {
        if(this.keys == '' || this.keys === 'undefined') return [];
        return Object.keys(this.keys.publicKeys);
    }

	private reconstructKey(shares): string {
		if(typeof shares[0] == "string") {
			return secrets.combine(shares);
		}

        if(typeof this.auths === 'undefined') {
            alert('You are not logged in!');
            return null;
        }

        var recipentNameArray = Object.keys(shares[0]);
        if(!this.hasAccessToFile(recipentNameArray)) {
            alert('You are not allowed to download this file!');
            return null;
        }

        var auth = this.getAccessAuth(recipentNameArray),
            combinableShares = [];

        for(var i = 0; i < shares.length; i++) {
            combinableShares.push(shares[i][auth.getName()]);
        }

        var encryptedHexKey = secrets.combine(combinableShares),
            encryptedKey = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(encryptedHexKey)),
            decrypter = new JSEncrypt();

        decrypter.setPrivateKey(auth.getPrivateKey());

        return decrypter.decrypt(encryptedKey);
	}

	private createShares(key, amountOfShares, recipients): Object[] {
		if(recipients.length == 0) {
			return secrets.share(key, 2, 2);
		}

        var keys = {};
        for(var i = 0; i < recipients.length; i++) {
            if(!this.accountOrGroupExists(recipients[i])) {
                alert(recipients[i] + " is unknown");
                continue;
            }

            var encrypter = new JSEncrypt(),
                publicKey = this.getPublicKeyByName(recipients[i]);
            encrypter.setPublicKey(publicKey);

            var recKey = encrypter.encrypt(key),
                recKeyHex = CryptoJS.enc.Hex.stringify(CryptoJS.enc.Base64.parse(recKey)),
                recShares = secrets.share(recKeyHex, 2, 2);

            keys[recipients[i]] = recShares;
        }

        var shares = [];
        for(var s = 0; s < amountOfShares; s++) {
            var obj = {};
            for(var i = 0; i < recipients.length; i++) {
                obj[recipients[i]] = keys[recipients[i]][s];
            }
            shares.push(obj);
        }

		return shares
	}

    private getAllAuthGroupNames(): string[] {
        var groupNames = [];
        for(var i = 0; i < this.auths.length; i++) {
            if(this.auths[i].isGroup()) groupNames.push(this.auths[i].getName());
        }
        return groupNames;
    }

    private getAccessAuth(recipentsArray: string[]): Auth {
        for(var i = 0; i < this.auths.length; i++) {
            if(this.auths[i].hasAccess(recipentsArray)) return this.auths[i];
        }
        return null;
    }

	private accountOrGroupExists(name): boolean {
        return this.keys.publicKeys.hasOwnProperty(name);
	}

	private getPublicKeyByName(name): string {
		if(this.accountOrGroupExists(name)) {
			return this.keys.publicKeys[name];
		} else {
			return null;
		}
	}
}