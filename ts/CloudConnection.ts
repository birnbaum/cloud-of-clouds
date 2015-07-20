///<reference path="References.ts" />

class CloudConnection {
	
    private CRC = CloudRailClient;
    private CRI = this.CRC.CloudRailInterface;
    private serviceTag: string;
    private serviceClient;
    private userIdentity;
    private rootFile;

    constructor(name: string, cloudId: string, cloudRailID: string) {
        this.serviceTag = name;
        this.serviceClient = new this.CRC.ClientIdentity(this.serviceTag, {'client_id': cloudId});

        this.CRC.setClientID(cloudRailID);
        this.CRI.initService(this.serviceTag);
    }

    /**
     * Establishes connection and returns the cloud account name and information about the clouds available storage space
     * @returns {JQueryPromise<string[]>}
     */
    connectCloud(): JQueryPromise<string[]> {
        this.userIdentity = new this.CRC.UserIdentity(this.serviceTag, {});
        return $.Deferred((d) => this.userIdentity.read(this.serviceClient, (resp) => {
        	if (resp.getStatus() != 200) alert('Not authorized!');
	
	        this.userIdentity = resp.getResults()[0];
	        this.rootFile = new this.CRC.File(this.serviceTag, {});

	        this.rootFile.read(this.userIdentity, (resp) => {
	            if (resp.getStatus() != 200) alert('Reading root directory failed!');
                this.printCloudInfo().done((name, info) => {
                    d.resolve(name, info);
                });
	        });
        })).promise();
    }

    /**
     * Expects a fileName, the files encrypted content and one share for each of the files keys
     * Returns a promise that will resolve to true if the upload was successful and to false if not
     * @param fileName
     * @param file
     * @param share
     * @returns {JQueryDeferred<boolean>}
     */
    upload(fileName, file, share): JQueryPromise<boolean> {
        var formatedShare = (typeof share == "string") ? '"'+share+'"' : JSON.stringify(share),
	        blob: Blob = new Blob(['{"file":',file,',"share":',formatedShare,'}']);

        return this.getFileByName(fileName).then(() => {
            if(arguments[0]) {
                console.log(this.serviceTag + ": " + fileName + ' is already existing');
                file = arguments[0];
                file.lStreamSize = blob.size;
                file.bStreamData = blob;
                file.selectStreamData();
                return file.update(this.userIdentity, (resp) => {
                    return (resp.getStatus() == 200);
                });
            } else {
                console.log(this.serviceTag + ": " + fileName + ' is not yet existing');
                var file = new this.CRC.File(this.serviceTag, {});
                file.sFilename = fileName;
                file.sMimeType = 'application/octet-stream';
                file.isDir = false;
                file.lStreamSize = blob.size;
                file.bStreamData = blob;
                return file.create(this.userIdentity, (resp) => {
                    return (resp.getStatus() == 200);
                });
            }
        });
    }

    /**
     * Expects the name of the file to download
     * Returns a promise that will resolve to the file and its share(s)
     * @param fileName
     * @returns {JQueryDeferred<Object[]>}
     */
    download(fileName): JQueryPromise<Object[]> {
        return $.Deferred((deferred) => this.getFileByName(fileName)
            .done(() => {
                var file = arguments[0],
                    reader = new FileReader();
                reader.onload = (e) => {
                    var parsedContent = JSON.parse(reader.result);
                    deferred.resolve(parsedContent.file, parsedContent.share);
                };
                try {
                    reader.readAsText(file.bStreamData);
                } catch(err) {
                    deferred.reject;
                }
	        })
            .fail(deferred.reject)
        );
    }

    /**
     * Returns the name of the cloud provider
     * @returns {string}
     */
    getName(): string {
    	return this.serviceTag;
    }

    /**
     * Returns true if the cloud connection is established and false if not
     * @returns {boolean}
     */
    isConnected(): boolean {
    	return (typeof this.userIdentity !== 'undefined');
    }

    /**
     * Returns a promise that will resolve to an array containing the name, size and recipients of all files on the cloud
     * @returns {JQueryDeferred<Object[]>}
     */
    getFileList(): JQueryDeferred<Object[]> {
        return $.Deferred((deferred) => this.CRI.read(this.rootFile, this.userIdentity, (res) => {
            if (res.getStatus() != 200) alert('Reading root directory failed!');
            
            var allFiles = res.getResults()[0].aniChilds,
            	promises = [];
            for (var i = 0; i < (allFiles.length || 0); i++) {
            	promises.push(this.getFileListItem(allFiles[i]));
            }
            
            $.when.apply($, promises).done(() => {
            	// cast arguments to array and remove undefined objects
            	deferred.resolve(Array.prototype.slice.call(arguments).filter((e) => {return e})); 
        	});
        }));
    }

    /**
     * Expects a file identifier and returns the corresponding file's name, size and recipients
     * @param identifier
     * @returns {JQueryDeferred<T>}
     */
    private getFileListItem(identifier): JQueryDeferred<Object> {
    	var file = CloudRailClient.Node.byIdentifier(identifier);
        file.selectAll();

        return $.Deferred((deferred) => this.CRI.read(file, this.userIdentity, (res) => {
            if (res.getStatus() != 200) alert('Reading file failed!');

            var child = res.getResults()[0];
            if(child.sFilename != 'keys.json') {
            	var reader = new FileReader();
            	reader.onload = (e) => {
    	        	var json = JSON.parse(reader.result);
    	    		var recipients = [];
    	        	if(typeof json.share != "string") recipients = Object.keys(json.share);
    	        	deferred.resolve({name: child.sFilename, size: child.lStreamSize, recipients: recipients});
    	        };
    	        reader.readAsText(child.bStreamData);
            } else {
            	deferred.resolve();
            }
        }));
    }

    /**
     * Returns a promise that will resolve to the cloud account name and information about the clouds available storage space
     * @returns {JQueryPromise<string[]>}
     */
    private printCloudInfo(): JQueryPromise<string[]> {
        var cloudAccountNameDeferred = $.Deferred(),
        	cloudInfoDeferred = $.Deferred();
        
        this.CRI.read(new CloudRailClient.UserAccountInfo(this.serviceTag), this.userIdentity, (res) => {
            if (res.getStatus() != 200) return alert('Could not read cloud account name');
            cloudAccountNameDeferred.resolve(res.getResults()[0].sDisplayName);
        });

        this.CRI.read(new CloudRailClient.FileStorage(this.serviceTag), this.userIdentity, (res) => {
            if (res.getStatus() != 200) return alert('Could not read cloud information');
            var fileStorage = res.getResults()[0];
            cloudInfoDeferred.resolve([fileStorage.lUsageSpace, fileStorage.lTotalSpace]);
        });

        return $.when(cloudAccountNameDeferred, cloudInfoDeferred);
    }

    /**
     * Expects the files name and returns a promise that will resolve to the file
     * @param name
     * @returns {JQueryDeferred<T>}
     */
    private getFileByName(name): JQueryPromise<Object> {
        return $.Deferred((deferred) => this.CRI.read(this.rootFile, this.userIdentity, (res) => {
            if (res.getStatus() != 200) deferred.reject();

            var allFiles = res.getResults()[0].aniChilds,
            	noMatchCounter = 0;

            if(allFiles.length <= 0) deferred.reject();
            for (var i = 0; i < (allFiles.length || 0); i++) {
                ((file) => {
                    var file = CloudRailClient.Node.byIdentifier(file);
                    file.selectAll();

                    this.CRI.read(file, this.userIdentity, (res) => {
                        if (res.getStatus() != 200) deferred.reject();

                        file = res.getResults()[0];
                        if (file.sFilename == name) {
                            deferred.resolve(file);
                        } else {
                            noMatchCounter++;
                            if(noMatchCounter == allFiles.length) deferred.resolve(false);
                        }
                    });
                })(allFiles[i]);
            }
        })).promise();
    }
}