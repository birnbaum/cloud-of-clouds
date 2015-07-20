///<reference path="References.ts" />
var Auth = (function () {
    function Auth(name, privateKey, group) {
        this.name = name;
        this.privateKey = privateKey;
        this.group = group;
    }
    Auth.prototype.getName = function () {
        return this.name;
    };
    Auth.prototype.getPrivateKey = function () {
        return this.privateKey;
    };
    Auth.prototype.isGroup = function () {
        return this.group;
    };
    Auth.prototype.hasAccess = function (recipientList) {
        for (var i = 0; i < recipientList.length; i++) {
            if (this.name == recipientList[i])
                return true;
        }
        return false;
    };
    return Auth;
})();
///<reference path="References.ts" />
var View = (function () {
    function View(controller, cloudNames, threshold) {
        var _this = this;
        this.downloadListener = function (e) {
            var fileName = $(e.target).data('name');
            console.group("Download " + fileName);
            console.time("Download");
            _this.controller.download(fileName).done(function (file) {
                console.timeEnd("Download");
                console.groupEnd();
                console.log(file);
                var pom = document.createElement('a');
                pom.setAttribute('href', file);
                pom.setAttribute('download', fileName);
                pom.click();
            }).fail(function () {
                alert("Download Error!");
            });
        };
        this.uploadListener = function () {
            var file = $('#fileChooser').prop('files')[0], recipients = $('#recipients').chosen().val() || [];
            if (typeof name === undefined)
                return;
            $('.uploadContent').remove();
            _this.$uploadContainer.append('<img src="img/spinner.gif">');
            console.group("Upload " + file.name);
            console.time("Upload");
            _this.controller.upload(file, recipients).done(function () {
                console.timeEnd("Upload");
                console.groupEnd();
                _this.refreshUploadContainer();
                setTimeout(_this.refreshFileContainer, 500);
            });
        };
        this.loginListner = function (e) {
            var nameInput = $('#loginName'), passwordInput = $('#loginPassword'), name = nameInput.val(), password = passwordInput.val(), groupNames = _this.controller.login(name, password);
            nameInput.remove();
            passwordInput.remove();
            $(e.target).remove();
            var loggedInText = '<p>Angemeldet als <strong>' + name + '</strong></p>';
            if (groupNames.length != 0) {
                loggedInText += 'Verfügbare Gruppen:<li>';
                for (var i = 0; i < groupNames.length; i++) {
                    loggedInText += '<ul>' + groupNames[i] + '</ul>';
                }
                loggedInText += '</li>';
            }
            else {
                loggedInText += 'Sie sind für keine Gruppen authorisiert.</p>';
            }
            $('#loginContainer').append(loggedInText);
            if (_this.controller.getCloudConnectionStatus() >= 1)
                _this.refreshFileContainer();
        };
        /**
         * Sends a connection Request to the associated CloudConnection,
         * prints the cloud information and updates the view
         */
        this.cloudConnectListener = function (e) {
            var $cloud = $(e.target).parent('.cloud'), cloudName = $cloud.attr('id');
            $cloud.find('.cloudConnectButton').remove();
            _this.$cloudsContainer.find('.cloudConnectButton').each(function () {
                $(this).prop("disabled", true);
            });
            $cloud.append('<img src="img/spinner.gif">');
            _this.controller.connectCloud(cloudName).done(function (name, info) {
                $cloud.find('img').remove();
                _this.$cloudsContainer.find('.cloudConnectButton').each(function () {
                    $(this).prop("disabled", false);
                });
                $cloud.append('<p>Angemeldet als <strong>' + name + '</strong><br>' + Util.formatFileSize(info[0]) + ' von ' + Util.formatFileSize(info[1]) + ' belegt<p>');
                if (_this.controller.getCloudConnectionStatus() >= 1) {
                    _this.refreshFileContainer();
                    if (_this.$loginContainer.find('p')) {
                        _this.$loginContainer.find('p').remove();
                        _this.$uploadContainer.find('p').remove();
                        _this.$uploadContainer.append('<img src="img/spinner.gif">');
                        _this.controller.init().done(_this.refreshUploadContainer).fail(function () {
                            _this.refreshUploadContainer();
                            _this.$uploadContainer.find('h5').after("<strong>Keine Schlüsseldatei vorhanden</strong>");
                        });
                        $.ajax({
                            url: "../html/login.html",
                            success: function (data) {
                                _this.$loginContainer.append(data);
                                $('#loginButton').click(_this.loginListner);
                            }
                        });
                    }
                }
            }).fail(function () {
                alert('Fehler');
            });
        };
        this.refreshUploadContainer = function () {
            if (_this.controller.getCloudConnectionStatus() < 2)
                return;
            $.ajax({
                url: "../html/upload.html",
                success: function (data) {
                    var $p = _this.$uploadContainer.find('p');
                    var $img = _this.$uploadContainer.find('img');
                    if ($p)
                        $p.remove();
                    if ($img)
                        $img.remove();
                    var rendered = Mustache.render(data, { names: _this.controller.getAllAccountAndGroupNames() });
                    _this.$uploadContainer.append(rendered);
                    $("#recipients").chosen({
                        placeholder_text_multiple: "Adressat hinzufügen",
                        no_results_text: "Adressat nicht gefunden"
                    });
                    $('.uploadButton').click(_this.uploadListener);
                }
            });
        };
        this.refreshFileContainer = function () {
            var $p = _this.$fileContainer.find('p');
            var $t = _this.$fileContainer.find('table');
            if ($p)
                $p.remove();
            if ($t)
                $t.remove();
            _this.$fileContainer.append('<img src="img/spinner.gif">');
            _this.controller.getFileList().done(function (files) {
                $.ajax({
                    url: "../html/file.html",
                    success: function (data) {
                        var sortedFiles = files.sort(_this.compareFiles), rendered = Mustache.render(data, { files: sortedFiles });
                        _this.$fileContainer.find('img').remove();
                        _this.$fileContainer.append(rendered);
                        var dlL = _this.downloadListener;
                        $.each($('.downloadButton'), function () {
                            $(this).click(dlL);
                        });
                    }
                });
            });
        };
        this.controller = controller;
        this.$loginContainer = $('#loginContainer');
        this.$cloudsContainer = $('#cloudsContainer');
        this.$uploadContainer = $('#uploadContainer');
        this.$fileContainer = $('#fileContainer');
        // render mustache
        var fileContainer = this.$fileContainer.find('p').html();
        var renderedFC = Mustache.render(fileContainer, { threshold: threshold });
        this.$fileContainer.find('p').html(renderedFC);
        var login = this.$loginContainer.find('.loginText').html();
        var renderedL = Mustache.render(login, { threshold: threshold });
        this.$loginContainer.find('.loginText').html(renderedL);
        for (var cloud in cloudNames) {
            (function (cloud) {
                $.ajax({
                    url: "../html/cloud.html",
                    success: function (data) {
                        var cName = cloudNames[cloud];
                        var rendered = Mustache.render(data, { CloudName: cName });
                        _this.$cloudsContainer.append(rendered);
                        $('#' + cName + ' .cloudConnectButton').click(_this.cloudConnectListener);
                    }
                });
            })(cloud);
        }
        // REMOVE
        $('h1').click(this.refreshFileContainer);
    }
    /**
     * Orders a list of file list items like this:
     * accessible and addressed > accessible and public > not accessible and addressed > not accessible and public
     */
    View.prototype.compareFiles = function (a, b) {
        if ((a.access && b.access) || (!a.access && !b.access)) {
            if (a.recipients.length > b.recipients.length) {
                return -1;
            }
            if (a.recipients.length < b.recipients.length) {
                return 1;
            }
            return 0;
        }
        else if (a.access) {
            return -1;
        }
        else {
            return 1;
        }
    };
    return View;
})();
///<reference path="References.ts" />
var CloudConnection = (function () {
    function CloudConnection(name, cloudId, cloudRailID) {
        this.CRC = CloudRailClient;
        this.CRI = this.CRC.CloudRailInterface;
        this.serviceTag = name;
        this.serviceClient = new this.CRC.ClientIdentity(this.serviceTag, { 'client_id': cloudId });
        this.CRC.setClientID(cloudRailID);
        this.CRI.initService(this.serviceTag);
    }
    /**
     * Establishes connection and returns the cloud account name and information about the clouds available storage space
     * @returns {JQueryPromise<string[]>}
     */
    CloudConnection.prototype.connectCloud = function () {
        var _this = this;
        this.userIdentity = new this.CRC.UserIdentity(this.serviceTag, {});
        return $.Deferred(function (d) { return _this.userIdentity.read(_this.serviceClient, function (resp) {
            if (resp.getStatus() != 200)
                alert('Not authorized!');
            _this.userIdentity = resp.getResults()[0];
            _this.rootFile = new _this.CRC.File(_this.serviceTag, {});
            _this.rootFile.read(_this.userIdentity, function (resp) {
                if (resp.getStatus() != 200)
                    alert('Reading root directory failed!');
                _this.printCloudInfo().done(function (name, info) {
                    d.resolve(name, info);
                });
            });
        }); }).promise();
    };
    /**
     * Expects a fileName, the files encrypted content and one share for each of the files keys
     * Returns a promise that will resolve to true if the upload was successful and to false if not
     * @param fileName
     * @param file
     * @param share
     * @returns {JQueryDeferred<boolean>}
     */
    CloudConnection.prototype.upload = function (fileName, file, share) {
        var _this = this;
        var formatedShare = (typeof share == "string") ? '"' + share + '"' : JSON.stringify(share), blob = new Blob(['{"file":', file, ',"share":', formatedShare, '}']);
        return this.getFileByName(fileName).then(function () {
            if (arguments[0]) {
                console.log(_this.serviceTag + ": " + fileName + ' is already existing');
                file = arguments[0];
                file.lStreamSize = blob.size;
                file.bStreamData = blob;
                file.selectStreamData();
                return file.update(_this.userIdentity, function (resp) {
                    return (resp.getStatus() == 200);
                });
            }
            else {
                console.log(_this.serviceTag + ": " + fileName + ' is not yet existing');
                var file = new _this.CRC.File(_this.serviceTag, {});
                file.sFilename = fileName;
                file.sMimeType = 'application/octet-stream';
                file.isDir = false;
                file.lStreamSize = blob.size;
                file.bStreamData = blob;
                return file.create(_this.userIdentity, function (resp) {
                    return (resp.getStatus() == 200);
                });
            }
        });
    };
    /**
     * Expects the name of the file to download
     * Returns a promise that will resolve to the file and its share(s)
     * @param fileName
     * @returns {JQueryDeferred<Object[]>}
     */
    CloudConnection.prototype.download = function (fileName) {
        var _this = this;
        return $.Deferred(function (deferred) { return _this.getFileByName(fileName).done(function () {
            var file = arguments[0], reader = new FileReader();
            reader.onload = function (e) {
                var parsedContent = JSON.parse(reader.result);
                deferred.resolve(parsedContent.file, parsedContent.share);
            };
            try {
                reader.readAsText(file.bStreamData);
            }
            catch (err) {
                deferred.reject;
            }
        }).fail(deferred.reject); });
    };
    /**
     * Returns the name of the cloud provider
     * @returns {string}
     */
    CloudConnection.prototype.getName = function () {
        return this.serviceTag;
    };
    /**
     * Returns true if the cloud connection is established and false if not
     * @returns {boolean}
     */
    CloudConnection.prototype.isConnected = function () {
        return (typeof this.userIdentity !== 'undefined');
    };
    /**
     * Returns a promise that will resolve to an array containing the name, size and recipients of all files on the cloud
     * @returns {JQueryDeferred<Object[]>}
     */
    CloudConnection.prototype.getFileList = function () {
        var _this = this;
        return $.Deferred(function (deferred) { return _this.CRI.read(_this.rootFile, _this.userIdentity, function (res) {
            if (res.getStatus() != 200)
                alert('Reading root directory failed!');
            var allFiles = res.getResults()[0].aniChilds, promises = [];
            for (var i = 0; i < (allFiles.length || 0); i++) {
                promises.push(_this.getFileListItem(allFiles[i]));
            }
            $.when.apply($, promises).done(function () {
                // cast arguments to array and remove undefined objects
                deferred.resolve(Array.prototype.slice.call(arguments).filter(function (e) {
                    return e;
                }));
            });
        }); });
    };
    /**
     * Expects a file identifier and returns the corresponding file's name, size and recipients
     * @param identifier
     * @returns {JQueryDeferred<T>}
     */
    CloudConnection.prototype.getFileListItem = function (identifier) {
        var _this = this;
        var file = CloudRailClient.Node.byIdentifier(identifier);
        file.selectAll();
        return $.Deferred(function (deferred) { return _this.CRI.read(file, _this.userIdentity, function (res) {
            if (res.getStatus() != 200)
                alert('Reading file failed!');
            var child = res.getResults()[0];
            if (child.sFilename != 'keys.json') {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var json = JSON.parse(reader.result);
                    var recipients = [];
                    if (typeof json.share != "string")
                        recipients = Object.keys(json.share);
                    deferred.resolve({ name: child.sFilename, size: child.lStreamSize, recipients: recipients });
                };
                reader.readAsText(child.bStreamData);
            }
            else {
                deferred.resolve();
            }
        }); });
    };
    /**
     * Returns a promise that will resolve to the cloud account name and information about the clouds available storage space
     * @returns {JQueryPromise<string[]>}
     */
    CloudConnection.prototype.printCloudInfo = function () {
        var cloudAccountNameDeferred = $.Deferred(), cloudInfoDeferred = $.Deferred();
        this.CRI.read(new CloudRailClient.UserAccountInfo(this.serviceTag), this.userIdentity, function (res) {
            if (res.getStatus() != 200)
                return alert('Could not read cloud account name');
            cloudAccountNameDeferred.resolve(res.getResults()[0].sDisplayName);
        });
        this.CRI.read(new CloudRailClient.FileStorage(this.serviceTag), this.userIdentity, function (res) {
            if (res.getStatus() != 200)
                return alert('Could not read cloud information');
            var fileStorage = res.getResults()[0];
            cloudInfoDeferred.resolve([fileStorage.lUsageSpace, fileStorage.lTotalSpace]);
        });
        return $.when(cloudAccountNameDeferred, cloudInfoDeferred);
    };
    /**
     * Expects the files name and returns a promise that will resolve to the file
     * @param name
     * @returns {JQueryDeferred<T>}
     */
    CloudConnection.prototype.getFileByName = function (name) {
        var _this = this;
        return $.Deferred(function (deferred) { return _this.CRI.read(_this.rootFile, _this.userIdentity, function (res) {
            if (res.getStatus() != 200)
                deferred.reject();
            var allFiles = res.getResults()[0].aniChilds, noMatchCounter = 0;
            if (allFiles.length <= 0)
                deferred.reject();
            for (var i = 0; i < (allFiles.length || 0); i++) {
                (function (file) {
                    var file = CloudRailClient.Node.byIdentifier(file);
                    file.selectAll();
                    _this.CRI.read(file, _this.userIdentity, function (res) {
                        if (res.getStatus() != 200)
                            deferred.reject();
                        file = res.getResults()[0];
                        if (file.sFilename == name) {
                            deferred.resolve(file);
                        }
                        else {
                            noMatchCounter++;
                            if (noMatchCounter == allFiles.length)
                                deferred.resolve(false);
                        }
                    });
                })(allFiles[i]);
            }
        }); }).promise();
    };
    return CloudConnection;
})();
///<reference path="References.ts" />
var SecurityManager = (function () {
    function SecurityManager(controller) {
        this.controller = controller;
        this.keys = "";
    }
    /**
     * Authenticates and authorizes the user. Returns the names of all accessable groups.
     */
    SecurityManager.prototype.login = function (name, password) {
        var encryptedPrivateKey = this.keys.privateKeys[name];
        if (encryptedPrivateKey) {
            var privateKey = CryptoJS.AES.decrypt(JSON.stringify(encryptedPrivateKey), password, { format: Util.JsonFormatter }).toString(CryptoJS.enc.Latin1);
            if (privateKey.substring(0, 31) != "-----BEGIN RSA PRIVATE KEY-----") {
                alert("Wrong Password");
            }
            else {
                console.info("Login successful");
            }
            var auth = new Auth(name, privateKey, false), groups = this.extractGroups();
            this.auths = this.getAllAuths(auth, groups);
        }
        return this.getAllAuthGroupNames();
    };
    /**
     * Extracts all non empty groups from the keys structure
     */
    SecurityManager.prototype.extractGroups = function () {
        var groups = {};
        for (var element in this.keys.privateKeys) {
            if (!this.keys.privateKeys.hasOwnProperty(element) || this.keys.privateKeys[element].hasOwnProperty('ct') || Object.keys(this.keys.privateKeys[element]).length === 0) {
                continue;
            }
            groups[element] = this.keys.privateKeys[element];
        }
        return groups;
    };
    SecurityManager.prototype.getAllAuths = function (userAuth, allGroups) {
        var allAuths = [], remainingGroups = allGroups, authStack = [userAuth];
        while (authStack.length > 0) {
            var auth = authStack.shift();
            for (var group in remainingGroups) {
                if (typeof remainingGroups[group][auth.getName()] !== 'undefined') {
                    var newAuth = this.createAuth(auth, group, remainingGroups[group]);
                    delete remainingGroups[group];
                    authStack.push(newAuth);
                }
            }
            allAuths.push(auth);
        }
        return allAuths;
    };
    SecurityManager.prototype.createAuth = function (childAuth, groupName, group) {
        var encryptedGroupPrivateKey = group[childAuth.getName()];
        var encryptedSymmetricKey = encryptedGroupPrivateKey.encryptedSymmetricKey, encryptedPrivateKey = encryptedGroupPrivateKey.encryptedPrivateKey;
        var decrypter = new JSEncrypt();
        decrypter.setPrivateKey(childAuth.getPrivateKey());
        var symmetricKey = decrypter.decrypt(encryptedSymmetricKey);
        var groupPrivateKey = CryptoJS.AES.decrypt(JSON.stringify(encryptedPrivateKey), symmetricKey, { format: Util.JsonFormatter }).toString(CryptoJS.enc.Latin1);
        return new Auth(groupName, groupPrivateKey, true);
    };
    SecurityManager.prototype.combineAndDecrypt = function (files, shares, isBenchmarkTest) {
        if (isBenchmarkTest === void 0) { isBenchmarkTest = false; }
        if (!isBenchmarkTest)
            console.time("combine and decrypt");
        var key = this.reconstructKey(shares), file = files[0], decrypted = CryptoJS.AES.decrypt(JSON.stringify(file), key, { format: Util.JsonFormatter }).toString(CryptoJS.enc.Latin1);
        if (!isBenchmarkTest)
            console.timeEnd("combine and decrypt");
        return decrypted;
    };
    SecurityManager.prototype.encryptAndSplit = function (file, recipients, isBenchmarkTest) {
        var _this = this;
        if (isBenchmarkTest === void 0) { isBenchmarkTest = false; }
        if (!isBenchmarkTest)
            console.time("encrypt and split");
        var reader = new FileReader(), amountOfShares = this.controller.getTotalCloudCount();
        return $.Deferred(function (deferred) {
            reader.onload = function (e) {
                var data = reader.result, key = secrets.random(256), encrypted = CryptoJS.AES.encrypt(data, key, { format: Util.JsonFormatter }), shares = _this.createShares(key, amountOfShares, recipients), filesArray = [], sharesArray = [];
                for (var i = 0; i < amountOfShares; i++) {
                    filesArray.push(encrypted);
                    sharesArray.push(shares[i]);
                }
                if (!isBenchmarkTest)
                    console.timeEnd("encrypt and split");
                deferred.resolve([filesArray, sharesArray]);
            };
            reader.readAsDataURL(file);
        }).promise();
    };
    SecurityManager.prototype.setKeys = function (keys) {
        this.keys = keys;
    };
    SecurityManager.prototype.hasAccessToFile = function (namelist) {
        if (namelist.length == 0) {
            return true;
        }
        else if (typeof this.auths === 'undefined') {
            return false;
        }
        else {
            for (var i = 0; i < this.auths.length; i++) {
                if (namelist.indexOf(this.auths[i].getName()) > -1)
                    return true;
            }
            return false;
        }
    };
    SecurityManager.prototype.getAllAccountAndGroupNames = function () {
        if (this.keys == '' || this.keys === 'undefined')
            return [];
        return Object.keys(this.keys.publicKeys);
    };
    SecurityManager.prototype.reconstructKey = function (shares) {
        if (typeof shares[0] == "string") {
            return secrets.combine(shares);
        }
        if (typeof this.auths === 'undefined') {
            alert('You are not logged in!');
            return null;
        }
        var recipentNameArray = Object.keys(shares[0]);
        if (!this.hasAccessToFile(recipentNameArray)) {
            alert('You are not allowed to download this file!');
            return null;
        }
        var auth = this.getAccessAuth(recipentNameArray), combinableShares = [];
        for (var i = 0; i < shares.length; i++) {
            combinableShares.push(shares[i][auth.getName()]);
        }
        var encryptedHexKey = secrets.combine(combinableShares), encryptedKey = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(encryptedHexKey)), decrypter = new JSEncrypt();
        decrypter.setPrivateKey(auth.getPrivateKey());
        return decrypter.decrypt(encryptedKey);
    };
    SecurityManager.prototype.createShares = function (key, amountOfShares, recipients) {
        if (recipients.length == 0) {
            return secrets.share(key, 2, 2);
        }
        var keys = {};
        for (var i = 0; i < recipients.length; i++) {
            if (!this.accountOrGroupExists(recipients[i])) {
                alert(recipients[i] + " is unknown");
                continue;
            }
            var encrypter = new JSEncrypt(), publicKey = this.getPublicKeyByName(recipients[i]);
            encrypter.setPublicKey(publicKey);
            var recKey = encrypter.encrypt(key), recKeyHex = CryptoJS.enc.Hex.stringify(CryptoJS.enc.Base64.parse(recKey)), recShares = secrets.share(recKeyHex, 2, 2);
            keys[recipients[i]] = recShares;
        }
        var shares = [];
        for (var s = 0; s < amountOfShares; s++) {
            var obj = {};
            for (var i = 0; i < recipients.length; i++) {
                obj[recipients[i]] = keys[recipients[i]][s];
            }
            shares.push(obj);
        }
        return shares;
    };
    SecurityManager.prototype.getAllAuthGroupNames = function () {
        var groupNames = [];
        for (var i = 0; i < this.auths.length; i++) {
            if (this.auths[i].isGroup())
                groupNames.push(this.auths[i].getName());
        }
        return groupNames;
    };
    SecurityManager.prototype.getAccessAuth = function (recipentsArray) {
        for (var i = 0; i < this.auths.length; i++) {
            if (this.auths[i].hasAccess(recipentsArray))
                return this.auths[i];
        }
        return null;
    };
    SecurityManager.prototype.accountOrGroupExists = function (name) {
        return this.keys.publicKeys.hasOwnProperty(name);
    };
    SecurityManager.prototype.getPublicKeyByName = function (name) {
        if (this.accountOrGroupExists(name)) {
            return this.keys.publicKeys[name];
        }
        else {
            return null;
        }
    };
    return SecurityManager;
})();
///<reference path="References.ts" />
var Util;
(function (Util) {
    Util.JsonFormatter = {
        stringify: function (cipherParams) {
            var jsonObj = {
                ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64),
                iv: "",
                s: ""
            };
            if (cipherParams.iv)
                jsonObj.iv = cipherParams.iv.toString();
            if (cipherParams.salt)
                jsonObj.s = cipherParams.salt.toString();
            return JSON.stringify(jsonObj);
        },
        parse: function (jsonStr) {
            var jsonObj = JSON.parse(jsonStr);
            var cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
            });
            if (jsonObj.iv)
                cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
            if (jsonObj.s)
                cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
            return cipherParams;
        }
    };
    function formatFileSize(bytes) {
        if (bytes == 0)
            return '0 Byte';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
    }
    Util.formatFileSize = formatFileSize;
})(Util || (Util = {}));
var Register;
(function (Register) {
    function empty() {
        controller.getSecurityManager().keys = {
            publicKeys: {},
            privateKeys: {}
        };
    }
    Register.empty = empty;
    function show() {
        console.log(controller.getSecurityManager().keys);
    }
    Register.show = show;
    function get() {
        var data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(controller.getSecurityManager().keys));
        var pom = document.createElement('a');
        pom.setAttribute('href', data);
        pom.setAttribute('download', 'keys.json');
        pom.click();
    }
    Register.get = get;
    function newAccount(name, password) {
        var crypter = new JSEncrypt({ default_key_size: 2048 }), publicKey = crypter.getPublicKey().replace(/(\r\n|\n|\r)/gm, ""), privateKey = crypter.getPrivateKey().replace(/(\r\n|\n|\r)/gm, ""), encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, password, { format: Util.JsonFormatter });
        var keys = controller.getSecurityManager().keys;
        keys.publicKeys[name] = publicKey;
        keys.privateKeys[name] = JSON.parse(encryptedPrivateKey);
        console.log(publicKey);
        console.log(JSON.stringify(JSON.parse(encryptedPrivateKey.toString())));
    }
    Register.newAccount = newAccount;
    function newGroup(name, members) {
        var crypter = new JSEncrypt({ default_key_size: 2048 }), publicKey = crypter.getPublicKey().replace(/(\r\n|\n|\r)/gm, ""), privateKey = crypter.getPrivateKey().replace(/(\r\n|\n|\r)/gm, ""), encryptedGroupPrivateKeys = {};
        var keys = controller.getSecurityManager().keys, error = false;
        for (var i = 0; i < members.length; i++) {
            var accountPublicKey = keys.publicKeys[members[i]], symmetricKey = secrets.random(256);
            var encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, symmetricKey, { format: Util.JsonFormatter });
            var encrypter = new JSEncrypt();
            encrypter.setPublicKey(accountPublicKey);
            var encryptedSymmetricKey = encrypter.encrypt(symmetricKey);
            if (!encryptedSymmetricKey) {
                console.log("Error: " + members[i] + " unknown.");
                error = true;
            }
            encryptedGroupPrivateKeys[members[i]] = {
                encryptedSymmetricKey: encryptedSymmetricKey,
                encryptedPrivateKey: JSON.parse(encryptedPrivateKey.toString())
            };
        }
        if (error)
            return null;
        keys.publicKeys[name] = publicKey;
        keys.privateKeys[name] = encryptedGroupPrivateKeys;
        console.log(publicKey);
        console.log(JSON.stringify(encryptedGroupPrivateKeys));
    }
    Register.newGroup = newGroup;
})(Register || (Register = {}));
var Benchmark;
(function (Benchmark) {
    function upload(count, recipients) {
        var file = $('#fileChooser').prop('files')[0];
        console.time(file.name);
        recursiveUploadKrypto(file, recipients, count);
    }
    Benchmark.upload = upload;
    function download(count, name) {
        downloadHelper(name).done(function () {
            var files = arguments[0][0], shares = arguments[0][1];
            console.time(name);
            for (var i = 0; i < count; i++) {
                controller.getSecurityManager().combineAndDecrypt(files, shares, true);
            }
            console.timeEnd(name);
        });
    }
    Benchmark.download = download;
    function recursiveUploadKrypto(file, recipients, counter) {
        controller.getSecurityManager().encryptAndSplit(file, recipients, true).done(function () {
            if (counter == 1) {
                console.timeEnd(file.name);
            }
            else {
                recursiveUploadKrypto(file, recipients, counter - 1);
            }
        });
    }
    function downloadHelper(fileName) {
        var deferreds = [];
        for (var i = 0; i < controller.threshold; i++) {
            (function (connection) {
                console.time(connection.getName() + ' download');
                var fileRead = $.Deferred();
                deferreds.push(fileRead);
                connection.download(fileName).done(function (files, shares) { return fileRead.resolve(files, shares); });
            })(controller.connections[i]);
        }
        return $.when.apply($, deferreds).then(function () {
            var files = [], shares = [];
            for (var i = 0; i < arguments.length; i++) {
                files.push(arguments[i][0]);
                shares.push(arguments[i][1]);
            }
            return [files, shares];
        });
    }
})(Benchmark || (Benchmark = {}));
///<reference path="interfaces/cryptojs.d.ts" />
///<reference path="interfaces/jsencrypt.d.ts" />
///<reference path="interfaces/cloudrail.d.ts" />
///<reference path="interfaces/secrets.d.ts" />
///<reference path="interfaces/jquery.d.ts" />
///<reference path="interfaces/mustache.d.ts" />
///<reference path="interfaces/chosen.d.ts" />
///<reference path="Controller.ts" />
///<reference path="Auth.ts" />
///<reference path="View.ts" />
///<reference path="CloudConnection.ts" />
///<reference path="SecurityManager.ts" />
///<reference path="Modules.ts" /> 
///<reference path="References.ts" />
var Controller = (function () {
    function Controller(params) {
        this.cloudrailID = params.cloudrailID;
        this.threshold = params.threshold;
        this.connections = [];
        var clouds = params.cloudIDs, cloudNames = [];
        for (var cloudName in clouds) {
            cloudNames.push(cloudName);
            var connection = new CloudConnection(cloudName, clouds[cloudName], this.cloudrailID);
            this.connections.push(connection);
        }
        this.securityManager = new SecurityManager(this);
        this.view = new View(this, cloudNames, this.threshold);
    }
    /**
     * Downloads and parses keys.json and sets the keys in the securityManager
     */
    Controller.prototype.init = function () {
        var _this = this;
        return this.download("keys.json").then(function (file) { return _this.securityManager.setKeys(JSON.parse(atob(file.substring(13)))); });
    };
    Controller.prototype.connectCloud = function (cloudName) {
        for (var connection in this.connections) {
            var cloud = this.connections[connection];
            if (cloud.getName() == cloudName)
                return cloud.connectCloud();
        }
    };
    /**
     * Authenticates and authorizes the user. Returns the names of all accessable groups.
     * @param name
     * @param password
     * @returns {string[]}
     */
    Controller.prototype.login = function (name, password) {
        return this.securityManager.login(name, password);
    };
    /**
     * Expects the file and it's recipients (optional).
     * Returns a promise that indicates when the upload has finished
     * @param file
     * @param recipients
     * @returns {JQueryPromise<void>}
     */
    Controller.prototype.upload = function (file, recipients) {
        var _this = this;
        return this.securityManager.encryptAndSplit(file, recipients).then(function (result) {
            var uploadDeferreds = [], files = result[0], shares = result[1];
            for (var i = 0; i < _this.connections.length; i++) {
                (function (connection) {
                    console.time(connection.getName() + ' upload');
                    var upload = connection.upload(file.name, files[i], shares[i]).then(function () {
                        console.timeEnd(connection.getName() + ' upload');
                    });
                    uploadDeferreds.push(upload);
                })(_this.connections[i]);
            }
            return $.when.apply($, uploadDeferreds);
        });
    };
    /**
     * Expects the files name and returns the reconstructed file as a data URL
     * @param fileName
     * @returns {JQueryPromise<string>}
     */
    Controller.prototype.download = function (fileName) {
        var _this = this;
        var deferreds = [];
        for (var i = 0; i < this.threshold; i++) {
            (function (connection) {
                console.time(connection.getName() + ' download');
                deferreds.push(connection.download(fileName));
            })(this.connections[i]);
        }
        return $.when.apply($, deferreds).then(function () {
            var files = [], shares = [];
            for (var i = 0; i < arguments.length; i++) {
                files.push(arguments[i][0]);
                shares.push(arguments[i][1]);
            }
            return _this.securityManager.combineAndDecrypt(files, shares);
        });
    };
    /**
     * Returns a promise that will resolve to an array containing the name, size and recipients of all files on the cloud
     * @returns {JQueryDeferred<Object[]>}
     */
    Controller.prototype.getFileList = function () {
        var _this = this;
        var cloudResponses = [];
        for (var i = 0; i < this.threshold; i++) {
            cloudResponses.push(this.connections[i].getFileList());
        }
        return $.when.apply($, cloudResponses).then(function () {
            var fileList = arguments[0]; // No integrity check -> taking the first result
            for (var i = 0; i < fileList.length; i++) {
                var file = fileList[i];
                file.size = Util.formatFileSize(file.size);
                file.access = _this.securityManager.hasAccessToFile(file.recipients);
            }
            return fileList;
        });
    };
    /**
     * returns 2 if all clouds are connected, 1 if the threshold for downloads is reached and 0 else
     * @returns {number}
     */
    Controller.prototype.getCloudConnectionStatus = function () {
        var c = 0;
        for (var i in this.connections) {
            if (this.connections[i].isConnected())
                c++;
        }
        if (c == Object.keys(this.connections).length) {
            return 2; //all
        }
        else if (c >= this.threshold) {
            return 1; //threshold reached
        }
        else {
            return 0;
        }
    };
    Controller.prototype.getTotalCloudCount = function () {
        return this.connections.length;
    };
    Controller.prototype.getAllAccountAndGroupNames = function () {
        return this.securityManager.getAllAccountAndGroupNames();
    };
    Controller.prototype.getSecurityManager = function () {
        return this.securityManager;
    };
    return Controller;
})();
// Starting point
$(function main() {
    $.ajax({
        dataType: "json",
        url: "../config.json",
        success: function (data) { return controller = new Controller(data); }
    });
});
// For tests and benchmarks via console
var controller;
//# sourceMappingURL=cloudofclouds.js.map