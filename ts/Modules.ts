///<reference path="References.ts" />

module Util {
    export var JsonFormatter = {
        stringify: function (cipherParams) {
            var jsonObj = {
                ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64),
                iv: "",
                s: ""
            };

            if (cipherParams.iv) jsonObj.iv = cipherParams.iv.toString();
            if (cipherParams.salt) jsonObj.s = cipherParams.salt.toString();

            return JSON.stringify(jsonObj);
        },
        parse: function (jsonStr) {
            var jsonObj = JSON.parse(jsonStr);

            var cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
            });

            if (jsonObj.iv) cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv)
        if (jsonObj.s) cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s)

        return cipherParams;
        }
    }

    export function formatFileSize(bytes) {
        if (bytes == 0) return '0 Byte';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
    }
}


module Register {
    export function empty() {
        controller.getSecurityManager().keys = {
            publicKeys: {},
            privateKeys: {}
        }
    }
    export function show() {
        console.log(controller.getSecurityManager().keys);
    }
    export function get() {
        var data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(controller.getSecurityManager().keys));
        var pom = document.createElement('a');
        pom.setAttribute('href', data);
        pom.setAttribute('download', 'keys.json');
        pom.click();
    }

    export function newAccount(name, password) {
        var crypter = new JSEncrypt({default_key_size: 2048}),
            publicKey = crypter.getPublicKey().replace(/(\r\n|\n|\r)/gm,""),
            privateKey = crypter.getPrivateKey().replace(/(\r\n|\n|\r)/gm,""),
            encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, password, { format: Util.JsonFormatter });

        var keys = controller.getSecurityManager().keys;

        keys.publicKeys[name] = publicKey;
        keys.privateKeys[name] = JSON.parse(encryptedPrivateKey);

        console.log(publicKey);
        console.log(JSON.stringify(JSON.parse(encryptedPrivateKey.toString())));
    }

    export function newGroup(name, members) {
        var crypter = new JSEncrypt({default_key_size: 2048}),
            publicKey = crypter.getPublicKey().replace(/(\r\n|\n|\r)/gm,""),
            privateKey = crypter.getPrivateKey().replace(/(\r\n|\n|\r)/gm,""),
            encryptedGroupPrivateKeys = {};

        var keys = controller.getSecurityManager().keys,
            error = false;

        for(var i = 0; i < members.length; i++) {
            var accountPublicKey = keys.publicKeys[members[i]],
                symmetricKey = secrets.random(256);

            var encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, symmetricKey, { format: Util.JsonFormatter });

            var encrypter = new JSEncrypt();
            encrypter.setPublicKey(accountPublicKey);
            var encryptedSymmetricKey = encrypter.encrypt(symmetricKey);
            if(!encryptedSymmetricKey) {
                console.log("Error: " + members[i] + " unknown.")
                error = true;
            }

            encryptedGroupPrivateKeys[members[i]] = {
                encryptedSymmetricKey: encryptedSymmetricKey,
                encryptedPrivateKey: JSON.parse(encryptedPrivateKey.toString())
            }
        }
        if(error) return null;

        keys.publicKeys[name] = publicKey;
        keys.privateKeys[name] = encryptedGroupPrivateKeys;

        console.log(publicKey);
        console.log(JSON.stringify(encryptedGroupPrivateKeys));
    }
}


module Benchmark {
    export function upload(count: number, recipients: string[]) {
        var file = $('#fileChooser').prop('files')[0];
        console.time(file.name);
        recursiveUploadKrypto(file, recipients, count);
    }

    export function download(count: number, name) {
        downloadHelper(name).done(() => {
            var files = arguments[0][0],
                shares = arguments[0][1];

            console.time(name);
            for(var i = 0; i < count; i++) {
                controller.getSecurityManager().combineAndDecrypt(files, shares, true);
            }
            console.timeEnd(name);
        })
    }

    function recursiveUploadKrypto(file, recipients, counter) {
        controller.getSecurityManager().encryptAndSplit(file, recipients, true).done(() => {
            if(counter == 1) {
                console.timeEnd(file.name);
            } else {
                recursiveUploadKrypto(file, recipients, counter-1);
            }
        });
    }

    function downloadHelper(fileName: string) {
        var deferreds = [];
        for(var i = 0; i < controller.threshold; i++) {
            ((connection) => {
                console.time(connection.getName() + ' download');
                var fileRead = $.Deferred();
                deferreds.push(fileRead);
                connection.download(fileName).done((files, shares) => fileRead.resolve(files, shares));
            })(controller.connections[i]);
        }
        return $.when.apply($, deferreds).then(() => {
            var files = [],
                shares = [];
            for(var i = 0; i < arguments.length; i++) {
                files.push(arguments[i][0]);
                shares.push(arguments[i][1]);
            }
            return [files, shares];
        })
    }
}