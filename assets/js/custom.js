(function(){console.log("Version 1.4")})();

window.optimizelyTemplateTool = {
    initialize: function() {
        var app_config_string = optimizelyTemplateTool.appConfig.get();
        // If app config not there, display configuration element
        if (!app_config_string) {
            $('head').append('<style>#step_configure{display:block;}</style>');
        } else {
            $('head').append('<style>#step_experiment{display:block;}</style>');
            // Transform to Javascript object
            var app_config = JSON.parse(app_config_string);

            var optly = new OptimizelyAPI({
                password: app_config.password,
                client_id: 7696655230
            });
        }

        $(document).ready(function() {
            // Fill JSON config if available
            $('#step_configure .configuration').val(app_config_string ? app_config_string : '');
            // CodeMirror textarea
            var editor = CodeMirror.fromTextArea(document.getElementById('configuration'), {
                mode: "text/javascript",
                lineWrapping: true,
                lineNumbers: true,
                tabSize: 2,
                theme: "default"
            });
            // Hook up configuration save button to setter
            $('#step_configure .save').click(function(event) {
                event.preventDefault();
                var configure = optimizelyTemplateTool.appConfig.set(editor.getValue());
                if (configure == true) {
                    location.reload();
                } else if (configure instanceof Error) {
                    alert(configure.message);
                }
            });
            // Enable switching from experiment to configuration
            $('#settings_icon').click(function() {
                $('#step_configure').show();
                $('#step_experiment').hide();
                editor.refresh();
            });

            // If app config available, render fields
            for (var key in app_config.placeholders.experiment) {
                if (app_config.placeholders.experiment.hasOwnProperty(key)) {
                    $('#experiment-level')
                        .append('<li class="lego-form-field__item">\
                            <label class="lego-label" for="' + key + '">' + key + '</label>\
                            <input name="' + key + '" type="text" class="lego-text-input" pattern="' + app_config.placeholders.experiment[key] + '">\
                        </li>');
                }
            }
            for (var key in app_config.placeholders.variation) {
                if (app_config.placeholders.variation.hasOwnProperty(key)) {
                    if (app_config.placeholders.variation[key].source == 'filepicker') {

                        var li_item = $('<li class="lego-form-field__item">\
                            <label class="lego-label" for="' + key + '">' + key + '</label>\
                            <div class="preview"></div>\
                        </li>');
                        var el = $('<input name="' + key + '" type="filepicker" class="lego-button lego-button--brand" value="">')
                            .attr(app_config.placeholders.variation[key].options)
                            .change(function(event) {
                                $(li_item).find('.preview').html('<p><img src="' + event.originalEvent.fpfile.url + '"></p>').prepend('<p>').prepend(el);
                                $(el).attr({
                                    'class': '',
                                    'disabled': 'true'
                                }).addClass('lego-text-input').show();
                            });

                        $(li_item).append(el).appendTo('#variation-level');

                        filepicker.constructWidget(el);

                        $(el).detach();

                    } else {
                        $('#variation-level')
                            .append('<li class="lego-form-field__item">\
                            <label class="lego-label" for="' + key + '">' + key + '</label>\
                            <input name="' + key + '" type="text" class="lego-text-input" pattern="' + app_config.placeholders.variation[key] + '">\
                        </li>');
                    }
                }
            }

            // Add fields for variation-level placeholders to html form

            for (var key in app_config.placeholders.variation) {
                if (app_config.placeholders.variation.hasOwnProperty(key)) {
                    $('.variation-details ul')
                        .append("<li><div class=\"form-group\"><label for=\"" + key + "\">" + key + "</label><br><input name=\"" + key + "\" type=\"text\" placehold=\"" + key + "\" style=\"width:100%\"></div></li>");
                }
            }
        });

        //Submit happens
        $('#step_experiment form').submit(function(e) {
            console.log('experiment submitted');
            optimizelyTemplateTool.spinner('Creating experiment…');

            e.preventDefault();

            // TODO: Clean up spaghetti code


            function replacePlaceholders(){

                app_config = JSON.parse(JSON.stringify(app_config, function(key, value) {
                    if (typeof value === "string") {
                        //Replace values from experiment fields
                        for (var key in app_config.placeholders.experiment) {
                            var fieldvalue = $("#experiment-level input[name=\"" + key + "\"]").val() ? $("#experiment-level input[name=\"" + key + "\"]").val() : "";
                            var value = value.replace(new RegExp("{{" + key + "}}", 'g'), fieldvalue.replace(/\\([\s\S])|(")/g,"\\$1$2") );
                        }

                        //Replace values from variation fields
                        for (var key in app_config.placeholders.variation) {
                            var fieldvalue = $("#variation-level input[name=\"" + key + "\"]").val() ? $("#variation-level input[name=\"" + key + "\"]").val() : "";
                            var value = value.replace(new RegExp("{{" + key + "}}", 'g'), fieldvalue.replace(/\\([\s\S])|(")/g,"\\$1$2") );
                        }
                    }
                    return value;
                }));

                // console.log(app_config);

                return app_config;
            }

            //Creates an experiment
            function createExperiment(final_config) {

                optimizelyTemplateTool.spinner('Creating experiment…');

                // Create experiment
                optly.post('experiments', final_config.experiment, function(experiment) {
                    experiment_id = experiment.id;
                    console.log('experiment created: ');
                });
            }

            var newconfig = replacePlaceholders();
            console.log(newconfig);
            var final_config = replacePlaceholders();
            createExperiment(final_config);
            e.preventDefault();

            var waitForExperiment = setInterval(function() {
                if (optly.outstandingRequests == 0) {
                    clearInterval(waitForExperiment);
                    if (app_config.redirect_url == "NO_REDIRECT") {
                        optimizelyTemplateTool.spinner();
                    } else if (app_config.redirect_url === undefined) {
                        // just to be backward compatible but ideally no redirect_url would mean no redirect
                        optimizelyTemplateTool.spinner('Successfully Created the Experiment!');
                        window.location.href = "https://optimizely-solutions.github.io/Editorial-Testing-App/#success";
                        location.reload();
                    } else {
                        optimizelyTemplateTool.spinner('Successfully Created.');
                        app_config.redirect_url = app_config.redirect_url.replace("{{Experiment ID}}", experiment_id);
                        //window.location.href = app_config.redirect_url;
                        var win = window.open(app_config.redirect_url, '_blank');
                        win.focus();
                    }
                }
            }, 300);

        });

    },
    appConfig: {
        local_storage_key: 'optimizely_template_config',
        checkConfig: function(config) {
            // Check if empty
            if (config === null || config === '') {
                throw new Error("Configuration missing.");
            };
            // Check if valid JSON
            try {
                var config_obj = JSON.parse(config);
            } catch (e) {
                throw new Error("Configuration isn't valid JSON. Make sure to use a JSON Linter and no trailing commas.");
            }
            // Check if JSON matches schema by looking up a few values
            // TODO: Should create and load a full schema definition
            try {
                // if (typeof config_obj.experiment.edit_url == "undefined" ||
                //     config_obj.variations.description == "undefined") {
                //     throw true;
                // }
            } catch (e) {
                throw new Error("Configuration is missing important information. Please check the template definition based on the boilerplate.");
            }

        },
        get: function() {
            // Pull configuration from LocalStorage
            var local_storage_item = localStorage.getItem(this.local_storage_key);
            // Return false if not config not available or broken
            try {
                this.checkConfig(local_storage_item);
            } catch (e) {
                return false;
            }
            return local_storage_item;
        },
        set: function(config) {
            try {
                this.checkConfig(config);
            } catch (e) {
                return e;
            }

            localStorage.setItem(this.local_storage_key, config);

            return true;
        }
    },
    logger: function(e) {
        console.log("ERROR:");
        console.log(e);
    },
    spinner: function(message) {
        if (message != undefined) {
            $('#overlay').show();
            $('#status').text(message || "Please wait…");
        } else {
            $('#overlay').hide();
        }
    }

};

optimizelyTemplateTool.initialize();
