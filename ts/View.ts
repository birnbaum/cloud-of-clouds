///<reference path="References.ts" />

class View {
	
	private controller;
	private $loginContainer;
	private $cloudsContainer;
	private $uploadContainer;
	private $fileContainer;

    constructor(controller: Controller, cloudNames: string[], threshold: number) {
    	this.controller = controller;
    	this.$loginContainer = $('#loginContainer');
    	this.$cloudsContainer = $('#cloudsContainer');
    	this.$uploadContainer = $('#uploadContainer');
    	this.$fileContainer = $('#fileContainer');

    	// render mustache
    	var fileContainer = this.$fileContainer.find('p').html();
		var renderedFC = Mustache.render(fileContainer, {threshold: threshold});
		this.$fileContainer.find('p').html(renderedFC);
        var login = this.$loginContainer.find('.loginText').html();
        var renderedL = Mustache.render(login, {threshold: threshold});
        this.$loginContainer.find('.loginText').html(renderedL);
    	
    	for(var cloud in cloudNames) {
    		((cloud) => {
	    		$.ajax({
					url: "../html/cloud.html",
					success: (data) => {
						var cName = cloudNames[cloud];
						var rendered = Mustache.render(data, {CloudName: cName});
						this.$cloudsContainer.append(rendered);
						$('#' + cName + ' .cloudConnectButton').click(this.cloudConnectListener);
					}
				});
    		})(cloud);
        }
    	
    	// REMOVE
    	$('h1').click(this.refreshFileContainer);
    }

	downloadListener = (e) => {
		var fileName = $(e.target).data('name');
		
		console.group("Download " + fileName);
		console.time("Download");
		
		this.controller.download(fileName).done((file) => {
			console.timeEnd("Download");
			console.groupEnd();
			
			console.log(file);
			
			var pom = document.createElement('a');
			pom.setAttribute('href', file);
			pom.setAttribute('download', fileName);
			pom.click();
		}).fail(() => {
			alert("Download Error!");
		});
	}
	
	uploadListener = () => {
		var file = $('#fileChooser').prop('files')[0],
			recipients = $('#recipients').chosen().val() || [];

        if(typeof name === undefined) return;

        $('.uploadContent').remove();
        this.$uploadContainer.append('<img src="img/spinner.gif">');
		
		console.group("Upload " + file.name);
		console.time("Upload");
		
		this.controller.upload(file, recipients).done(() => {
			console.timeEnd("Upload");
			console.groupEnd();
            this.refreshUploadContainer();
            setTimeout(this.refreshFileContainer, 500);
		});
	}

	loginListner = (e) => {
		var nameInput = $('#loginName'),
			passwordInput = $('#loginPassword'),
			name = nameInput.val(),
			password = passwordInput.val(),
            groupNames = this.controller.login(name, password);

        nameInput.remove();
        passwordInput.remove();
        $(e.target).remove();

        var loggedInText = '<p>Angemeldet als <strong>' + name + '</strong></p>';
        if(groupNames.length != 0) {
            loggedInText += 'Verfügbare Gruppen:<li>'
            for(var i = 0; i < groupNames.length; i++) {
                loggedInText += '<ul>' + groupNames[i] + '</ul>';
            }
            loggedInText += '</li>';
        } else {
            loggedInText += 'Sie sind für keine Gruppen authorisiert.</p>'
        }
        $('#loginContainer').append(loggedInText);

        if(this.controller.getCloudConnectionStatus()>=1) this.refreshFileContainer();
	}
	
	/**
	 * Sends a connection Request to the associated CloudConnection,
	 * prints the cloud information and updates the view
	 */
	private cloudConnectListener = (e) => {
		var $cloud = $(e.target).parent('.cloud'),
			cloudName = $cloud.attr('id');
		$cloud.find('.cloudConnectButton').remove();
        this.$cloudsContainer.find('.cloudConnectButton').each(function() {
            $(this).prop("disabled", true);
        });
		$cloud.append('<img src="img/spinner.gif">');
		this.controller.connectCloud(cloudName).done((name, info) => {
			$cloud.find('img').remove();
            this.$cloudsContainer.find('.cloudConnectButton').each(function() {
                $(this).prop("disabled", false);
            });
			$cloud.append('<p>Angemeldet als <strong>'+name+'</strong><br>'+Util.formatFileSize(info[0])+' von '+Util.formatFileSize(info[1])+' belegt<p>');
			if(this.controller.getCloudConnectionStatus() >= 1) {
				this.refreshFileContainer();
				if(this.$loginContainer.find('p')) {
                    this.$loginContainer.find('p').remove();
                    this.$uploadContainer.find('p').remove();
                    this.$uploadContainer.append('<img src="img/spinner.gif">');
                    this.controller.init()
                        .done(this.refreshUploadContainer)
                        .fail(() => {
                            this.refreshUploadContainer();
                            this.$uploadContainer.find('h5').after("<strong>Keine Schlüsseldatei vorhanden</strong>");
                        });
					$.ajax({
						url: "../html/login.html",
						success: (data) => {
							this.$loginContainer.append(data);
							$('#loginButton').click(this.loginListner);
						}
					});
				}
			}
		}).fail(() => {
            alert('Fehler');
        });
	}

    private refreshUploadContainer = () => {
        if(this.controller.getCloudConnectionStatus() < 2) return;
        $.ajax({
            url: "../html/upload.html",
            success: (data) => {
                var $p = this.$uploadContainer.find('p');
                var $img = this.$uploadContainer.find('img');
                if($p) $p.remove();
                if($img) $img.remove();

                var rendered = Mustache.render(data, {names: this.controller.getAllAccountAndGroupNames()});
                this.$uploadContainer.append(rendered);
                $("#recipients").chosen({
                    placeholder_text_multiple: "Adressat hinzufügen",
                    no_results_text: "Adressat nicht gefunden"
                });
                $('.uploadButton').click(this.uploadListener);
            }
        });
    }

    private refreshFileContainer = () => {
        var $p = this.$fileContainer.find('p');
        var $t = this.$fileContainer.find('table');
        if($p) $p.remove();
        if($t) $t.remove();

        this.$fileContainer.append('<img src="img/spinner.gif">');

        this.controller.getFileList().done((files) => {
            $.ajax({
                url: "../html/file.html",
                success: (data) => {
                    var sortedFiles = files.sort(this.compareFiles),
                        rendered = Mustache.render(data, {files: sortedFiles});
                    this.$fileContainer.find('img').remove();
                    this.$fileContainer.append(rendered);

                    var dlL = this.downloadListener;
                    $.each($('.downloadButton'), function() {
                        $(this).click(dlL);
                    });
                }
            });
        });
    }

    /**
     * Orders a list of file list items like this:
     * accessible and addressed > accessible and public > not accessible and addressed > not accessible and public
     */
    private compareFiles(a, b): number {
        if ((a.access && b.access) || (!a.access && !b.access)) {
            if(a.recipients.length > b.recipients.length) {
                return -1;
            }
            if(a.recipients.length < b.recipients.length) {
                return 1;
            }
            return 0;
        } else if(a.access) {
            return -1;
        } else {
            return 1;
        }
    }
}