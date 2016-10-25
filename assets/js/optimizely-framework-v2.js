/*
The OptimizelyAPI class provides a connection to the API via Javascript and lets you make authenticated calls without repeating yourself.

We store the API token in each instance of the object, and we can connect to multiple different accounts by creating new instances of the OptimizelyAPI class.

Finally, we keep track of how many requests are outstanding so we can tell when all the calls are complete.
*/

OptimizelyAPI = function(auth) {
    this.outstandingRequests = 0;
    this.client_id = auth.oauth_client_id;
    this.password = auth.password;
    this.token = this.extractToken(document.location.hash);
    if (this.token) {
        // Remove token from URI
        document.location.hash = "";
        //Save token to localstorage
        if (window.localStorage) {
            AES_Init();
            var block = new Array(16);
            for(var i = 0; i < 16; i++)
              block[i] = 0x11 * i;

            var key = new Array(32);
            for(var i = 0; i < 32; i++)
              key[i] = i;

            console.log(AES_ExpandKey(key));
            console.log(AES_Encrypt(block, key));
            console.log(AES_Done());
            window.localStorage.setItem('bearer', JSON.stringify({token: this.token, time: (Math.floor(Date.now() / 1000))}));
        }
    } else {
        //Check if token is in localstorage
        if (window.localStorage) {
            var bearer = window.localStorage.getItem('bearer');
            //Check if the token is younger than 2 hours (tokens expire after that)
            if ((Math.floor(Date.now() / 1000) - bearer.time) < 7000) this.token = bearer.token;
        }
        //No token found in localstorage, proceed to auth
        if (!this.token){
            // If no OAuth token, redirect to auth endpoint
            this.authorizeClient();
        }
    }
}

OptimizelyAPI.prototype.authorizeClient = function() {

    var CLIENT_ID = this.client_id || 7696655230;
    var AUTHORIZATION_ENDPOINT = "https://app.optimizely.com/oauth2/authorize";

    var authUrl = AUTHORIZATION_ENDPOINT +
        "?response_type=token" +
        "&scopes=all" +
        "&client_id=" + CLIENT_ID +
        "&state=12345" +
        "&redirect_uri=" + "https:" + window.location.href.substring(window.location.protocol.length);

    window.location.href = authUrl;
}

OptimizelyAPI.prototype.extractToken = function(hash) {
    var match = hash.match(/access_token=([\w:]+)/);
    return !!match && match[1];
};

OptimizelyAPI.prototype.call = function(type, endpoint, data, callback) {

    var self = this;

    var options = {
        url: "https://www.optimizelyapis.com/experiment/v1/" + endpoint,
        type: type,
        dataType: 'json',
        contentType: 'application/json',
        beforeSend: function(xhr) {
            if (self.auth_mode == "api_key") {
                xhr.setRequestHeader('Token', self.token);
            } else {
                xhr.setRequestHeader('Authorization', "Bearer " + self.token);
                xhr.setRequestHeader('Accept', "application/json");
            }
        },
        success: function(response) {
            console.log(response);
            self.outstandingRequests -= 1;
            callback(response);
        },
        error: function(response, status, textstatus) {
            console.log('Error: ', textstatus);
            console.log(status);

            if (response.status == 403 && window.confirm("Sorry! Your 10-minute session isn't valid anymore.")) {
                authorizeClient();
            }
        }
    }

    if (data) {
        options.data = JSON.stringify(data);
        options.dataType = 'json';
    }

    this.outstandingRequests += 1;
    jQuery.ajax(options);

}


/*
Using our `call` function, we can define convenience functions for GETs, POSTs, PUTs, and DELETEs.
*/

OptimizelyAPI.prototype.get = function(endpoint, callback) {
    this.call('GET', endpoint, "", callback);
}

OptimizelyAPI.prototype.delete = function(endpoint, callback) {
    this.call('DELETE', endpoint, "", callback);
}

OptimizelyAPI.prototype.post = function(endpoint, data, callback) {
    this.call('POST', endpoint, data, callback);
}

OptimizelyAPI.prototype.put = function(endpoint, data, callback) {
    this.call('PUT', endpoint, data, callback);
}

/*
We've also added an extra convenience function, `patch`, that updates a model by changing only the specified fields. The function works by reading in an entity, changing a few keys, and then sending it back to Optimizely.
*/

OptimizelyAPI.prototype.patch = function(endpoint, data, callback) {
    var self = this;
    self.get(endpoint, function(base) {
        for (var key in data) {
            base[key] = data[key];
        }
        self.put(endpoint, base, callback);
    });
}