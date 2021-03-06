var OAuth = require('./oauth/oauth');
var utils = require('./util/utils');
var mime = require('./mime/mime');
var fs = require('fs');
var path = require('path');


function Cocoafish(key, secret, baseURL) {
	if (!secret) {
		this.appKey = key;
	} else {
		this.oauthKey = key;
		this.oauthSecret = secret;
	}
	if (baseURL) {
		if(baseURL.indexOf(":") > 0) {
			this.apiBaseURL = baseURL.substring(0, baseURL.indexOf(":"));
			this.apiPort = baseURL.substring(baseURL.indexOf(":") + 1);
		} else {
			this.apiBaseURL = baseURL;
		}
	} else {
		this.apiBaseURL = utils.baseURL;
	}
	return this;
}

Cocoafish.prototype.sendRequest = function(url, method, data, callback, useSecure) {
	var authType = utils.getAuthType(this);
	if(authType == utils.unknown) {
		callback(utils.noAppKeyError);
		return;
	}
	
	var isSecure = true;
	if(arguments.length == 4) {
		isSecure = true;
	} else if(arguments.length == 5) {
		isSecure = useSecure;
	} else {
		callback(utils.invalidArgumentError);
		return;
	}
	
	var protocal = "http://";
	if(isSecure) {
		protocal = "https://";
	}
	
	var port = this.apiPort;
	if(!port) {
		if(isSecure){
			port = 443;
		} else {
			port = 80;
		}
	}
	
	//build request url
	var reqURL = '';
	reqURL += "/" + utils.version + "/" + url;
	
	if(authType == utils.app_key) {
		reqURL += utils.keyParam + this.appKey;
	}
	
	if(data == null)
		data = {};
	
	var apiMethod = method ? method.toUpperCase() : utils.get_method;
	data[utils.suppressCode] = 'true';
	sessionId = this.session_id;
	
	if (sessionId) {
		if(reqURL.indexOf("?") != -1) {
			reqURL += "&" + utils.sessionId + '=' + sessionId;
		} else {
			reqURL += "?" + utils.sessionId + '=' + sessionId;
		}
	}
	
	data = utils.cleanInvalidData(data);
	
	var fileObj = utils.getFileObject(data);
	if(fileObj) {
		//send request with file
		if(typeof fileObj != 'string') {
			callback(utils.fileTypeError);
			return;
		}
		
		try {
			var binary = fs.readFileSync(fileObj);
			if(binary) {
				var filePropName = 'file';
				if(data['file']) {
					delete data['file'];
				} else if(data['photo']) {
					delete data['photo'];
					filePropName = 'photo';
				}
				
				var mimeType = mime.lookup(fileObj);
				if(!mimeType) {
					mimeType = 'text/plain';
				}
				
				var fileName = path.basename(fileObj);
				
				var header = {};
				if(authType == utils.oauth) {
					var message = { 
						method: apiMethod,
						parameters: []
					};
					
					if(port != 443 && port != 80) {
						message['action'] = protocal + this.apiBaseURL + ":" + port + reqURL;
					} else {
						message['action'] = protocal + this.apiBaseURL + reqURL;
					}
					utils.populateOAuthParameters(message.parameters, this.oauthKey);
					OAuth.completeRequest(message, {consumerSecret: this.oauthSecret});
					header[utils.oauth_header] = OAuth.getAuthorizationHeader("", message.parameters);
				}
				
				utils.sendRequestWithFile(this.apiBaseURL, port, reqURL, apiMethod, data, header, isSecure, callback, this, filePropName, fileName, binary, mimeType);
			} else {
				callback(utils.fileLoadError);
				return;
			}
		} catch(e) {
			callback(utils.fileLoadError);
			return;
		}	
	} else {
		//send request without file
		var header = {};
		if(authType == utils.oauth) {
			var message = { 
				method: apiMethod,
				parameters: []
			};
			
			if(port != 443 && port != 80) {
				message['action'] = protocal + this.apiBaseURL + ":" + port + reqURL;
			} else {
				message['action'] = protocal + this.apiBaseURL + reqURL;
			}
			
			for (prop in data) {
				if (!data.hasOwnProperty(prop)) {
					continue;
				}
				message.parameters.push([prop, data[prop]]);
			}
			utils.populateOAuthParameters(message.parameters, this.oauthKey);
			OAuth.completeRequest(message, {consumerSecret: this.oauthSecret});
			header[utils.oauth_header] = OAuth.getAuthorizationHeader("", message.parameters);
		}
		
		utils.sendRequest(this.apiBaseURL, port, reqURL, apiMethod, data, header, isSecure, callback, this);
	}
};

exports.createCocoafish = function(key, secret, baseURL) {
	return new Cocoafish(key, secret, baseURL);
};