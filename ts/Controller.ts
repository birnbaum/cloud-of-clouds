///<reference path="References.ts" />

class Controller {
	
	private cloudrailID: string;
	private threshold: number;
	private view: View;
	private connections: CloudConnection[];
	private securityManager: SecurityManager;

    constructor(params) {
    	this.cloudrailID = params.cloudrailID;
    	this.threshold = params.threshold;
    	
    	this.connections = [];
    	var clouds = params.cloudIDs,
    		cloudNames = [];
    	for(var cloudName in clouds) {
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
    init() {
        return this.download("keys.json").then((file) => this.securityManager.setKeys(JSON.parse(atob(file.substring(13)))));
    }

    connectCloud(cloudName: string) {
    	for(var connection in this.connections) {
    		var cloud = this.connections[connection];
    		if(cloud.getName() == cloudName) return cloud.connectCloud();
    	}
    }

    /**
     * Authenticates and authorizes the user. Returns the names of all accessable groups.
     * @param name
     * @param password
     * @returns {string[]}
     */
    login(name: string, password: string): string[] {
    	return this.securityManager.login(name, password);
	}

    /**
     * Expects the file and it's recipients (optional).
     * Returns a promise that indicates when the upload has finished
     * @param file
     * @param recipients
     * @returns {JQueryPromise<void>}
     */
	upload(file, recipients): JQueryPromise<void> {
		return this.securityManager.encryptAndSplit(file, recipients).then((result) => {
	    	var uploadDeferreds = [],
				files = result[0],
				shares = result[1];
			
	        for(var i = 0; i < this.connections.length; i++) {		    	
	        	((connection) => {
	    			console.time(connection.getName() + ' upload');
                    var upload = connection.upload(file.name, files[i], shares[i]).then(() => {
		    			console.timeEnd(connection.getName() + ' upload');
		        	});
                    uploadDeferreds.push(upload);
	        	})(this.connections[i]);
	        }

	        return $.when.apply($, uploadDeferreds)
		});
	}

    /**
     * Expects the files name and returns the reconstructed file as a data URL
     * @param fileName
     * @returns {JQueryPromise<string>}
     */
	download(fileName: string): JQueryPromise<string> {
    	var deferreds = [];
    	for(var i = 0; i < this.threshold; i++) {
    		((connection) => {
    			console.time(connection.getName() + ' download');
	    		deferreds.push(connection.download(fileName));
    		})(this.connections[i]);
    	}

    	return $.when.apply($, deferreds).then(() => {
    		var files = [],
    			shares = [];
    		for(var i = 0; i < arguments.length; i++) {
    			files.push(arguments[i][0]);
    			shares.push(arguments[i][1]);
    		}
    		return this.securityManager.combineAndDecrypt(files, shares);
    	})
	}

    /**
     * Returns a promise that will resolve to an array containing the name, size and recipients of all files on the cloud
     * @returns {JQueryDeferred<Object[]>}
     */
    getFileList(): JQueryPromise<{}> {
    	var cloudResponses = [];
    	for(var i = 0; i < this.threshold; i++) {
            cloudResponses.push(this.connections[i].getFileList());
    	}

    	return $.when.apply($, cloudResponses).then(() => {
    		var fileList = arguments[0]; // No integrity check -> taking the first result
    		for(var i = 0; i < fileList.length; i++) {
    			var file = fileList[i];
    			file.size = Util.formatFileSize(file.size);
    			file.access = this.securityManager.hasAccessToFile(file.recipients);
    		}
    		return fileList;
    	});
	}

    /**
     * returns 2 if all clouds are connected, 1 if the threshold for downloads is reached and 0 else
     * @returns {number}
     */
	getCloudConnectionStatus() {
		var c = 0;
		for(var i in this.connections) {
			if(this.connections[i].isConnected()) c++;
		}

		if (c == Object.keys(this.connections).length) {
			return 2; //all
		} else if (c >= this.threshold) {
        	return 1; //threshold reached
        } else {
        	return 0
        }
	}

	getTotalCloudCount() {
		return this.connections.length;
	}

    getAllAccountAndGroupNames(): string[] {
        return this.securityManager.getAllAccountAndGroupNames();
    }

    getSecurityManager(): Object {
        return this.securityManager;
    }
}

// Starting point
$(function main() {
    $.ajax({
        dataType: "json",
        url: "../config.json",
        success: (data) => controller = new Controller(data)
    });
});

// For tests and benchmarks via console
var controller;