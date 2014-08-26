#!/usr/bin/env node

var express       = require('express');
var opening_hours = require('opening_hours');
var http          = require('http');
var fs            = require('fs');

var app = express();

var overpass_timeout = 60;
var project_name   = 'opening_hours_server.js';
var repository_url = 'https://github.com/ypid/' + project_name;
var bbox_url_parms = ['s', 'w', 'n', 'e'];
var listening_ports = [];
var cache_file_for_overpass_answer = 'cache.json';
var problem_code_to_problem = ['ok', 'warning', 'error'];
var filters = ['error', 'errorOnly', 'warnOnly'];
var nominatiomTestJSON = {"place_id":"44651229","licence":"Data \u00a9 OpenStreetMap contributors, ODbL 1.0. http:\/\/www.openstreetmap.org\/copyright","osm_type":"way","osm_id":"36248375","lat":"49.5400039","lon":"9.7937133","display_name":"K 2847, Lauda-K\u00f6nigshofen, Main-Tauber-Kreis, Regierungsbezirk Stuttgart, Baden-W\u00fcrttemberg, Germany, European Union","address":{"road":"K 2847","city":"Lauda-K\u00f6nigshofen","county":"Main-Tauber-Kreis","state_district":"Regierungsbezirk Stuttgart","state":"Baden-W\u00fcrttemberg","country":"Germany","country_code":"de","continent":"European Union"}};

/* Parameter parsing {{{ */
var debug = false;
var localhost_only = false;
var args = process.argv.splice(2);
for (var i = 0; i < args.length; i++) {
    if (args[i] === '-d' || args[i] === '--debug') {
        console.log("Running in debug mode.");
        debug = true;
    } else if (args[i] === '-l' || args[i] === '--localhost-only') {
        console.log("Binding on loop back device only.");
        localhost_only = true;
    } else {
        var port_number;
        try {
            port_number = parseInt(args[i]);
            if (port_number > 1) {
                listening_ports.push(port_number);
            } else {
                throw('NaN');
            }
        } catch (err) {
            throw('Unknown parameter: ' + args[i]);
        }
    }
}
if (listening_ports.length == 0) {
    throw("Please specify which port to use. You can addionally specify -d | --debug to run in debug mode and to omit overpass querys.");
}
/* }}} */

function parseOverpassAnswer(overpass_answer, filter, keys, oh_mode, res) {
    overpass_answer.generator += ', modified by the ' + project_name;
    filtered_elements = [];

    var number_of_elements = overpass_answer.elements.length;
    for (i = 0; i < number_of_elements; i++) {
        var tags = overpass_answer.elements[i].tags;
        var worst_problem = undefined;
        overpass_answer.elements[i].tag_problems = {};
        for (var key in tags) {
            if (keys.indexOf(key) != -1) {
                var warnings, crashed;
                try {
                    oh = new opening_hours(tags[key], nominatiomTestJSON, oh_mode);
                    warnings = oh.getWarnings();
                    crashed = false;
                } catch (err) {
                    crashed = err;
                }
                var problem = (crashed ? 2 : (warnings.length > 0 ? 1 : 0));
                overpass_answer.elements[i].tag_problems[key] = {
                    error: !!crashed,
                    eval_notes: (crashed ? [ crashed ] : warnings),
                };
                if (typeof worst_problem === 'undefined' || problem > worst_problem) {
                    worst_problem = problem;
                }
                if (debug && overpass_answer.elements[i].tag_problems[key].eval_notes) {
                    console.log(overpass_answer.elements[i].tag_problems[key].eval_notes);
                }
            }
        }
        if (filter < worst_problem)
            filtered_elements.push(overpass_answer.elements[i]);
    }
    overpass_answer.elements = filtered_elements;
    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify(overpass_answer, null, '  '));
}

app.get('/api/oh_interpreter', function(req, res) {
    var i;
    /* Error handling {{{ */
    var errors = [];
    if (typeof req.query.tag === 'string') {
        if (!req.query.tag.match(/^[A-Za-z:_-]+$/)) {
            errors.push("Unusal OSM key");
        }
    } else {
        errors.push("OSM key is missing.");
    }

    var bbox_coordinates = [];
    for (i = 0; i < bbox_url_parms.length; i++) {
        var coordinate = req.query[bbox_url_parms[i]];
        if (typeof coordinate === 'string') {
            if (!coordinate.match(/^-?\d+(?:\.\d+)?$/)) {
                errors.push("Coordinate " + bbox_url_parms[i] + " of bbox is not in the correct format.");
            } else {
                bbox_coordinates[i] = coordinate;
            }
        } else {
            errors.push("Coordinate " + bbox_url_parms[i] + " of bbox is missing.");
        }
    }
    var filter = filters.indexOf('error');
    if (typeof req.query.filter === 'string') {
        if (filters.indexOf(req.query.filter) === -1) {
            errors.push("Invalid filter: " + req.query.filter);
        } else {
            filter = filters.indexOf(req.query.filter);
        }
    }
    var oh_mode = 0;
    if (typeof req.query.mode === 'string') {
        if (!req.query.mode.match(/^[0-2]$/)) {
            errors.push("Invalid mode: " + req.query.filter);
        } else {
            oh_mode = parseInt(req.query.mode);
        }
    }
    if (errors.length > 0) {
        res.status(400).send(errors.join('<br>\n') + '<br><br>\nSee <a href="' + repository_url + '">documentation</a>.');
        return;
    }
    /* }}} */

    var components = [];
    var keys = req.query.tag.split(',');
    for (i = 0; i < keys.length; i++) {
        var key = keys[i];
        components.push("node['" + key + "'];");
        components.push("way['" + key + "'];");
    }

    var OverpassQL = '[out:json][timeout:' + overpass_timeout + '][bbox:' + bbox_coordinates.join(',') + '];(' + components.join('') + ');out body center;';

    var overpass_answer;
    if (!debug || !fs.existsSync(cache_file_for_overpass_answer)) {
        if (localhost_only) {
            console.log("%s: Executing query: %s", new Date(), OverpassQL);
        } else {
            console.log("%s: Executing query requested by %s: %s", new Date(), req.hostname, OverpassQL);
        }
        var encoded_json = '';
        var request = http.get({
            host: 'overpass-api.de',
            path: '/api/interpreter?data=' + encodeURIComponent(OverpassQL),
        }, function(response) {
            response.on('data', function(d) {
                encoded_json += d.toString();
            });
            response.on('end', function() {
                overpass_answer = JSON.parse(encoded_json);
                parseOverpassAnswer(overpass_answer, filter, keys, oh_mode, res);
                if (debug) {
                    fs.writeFile(cache_file_for_overpass_answer, encoded_json, function(err) {
                        if (err)
                            throw err;
                    });
                }
            });
        }).on('error', function(err) {
             throw("Got error: " + err.message);
        });
    }

    if (debug && fs.existsSync(cache_file_for_overpass_answer)) {
        console.log("Got query from %s, satisfying from cache file. Answer might be not appropriate to request.", req.hostname);
        overpass_answer = JSON.parse(fs.readFileSync(cache_file_for_overpass_answer));
        parseOverpassAnswer(overpass_answer, filter, keys, oh_mode, res);
    }

});

app.get('/api/get_license', function(req, res) {
    res.send('<html><head><title>LICENSE</title></head><body><pre>' + fs.readFileSync('LICENSE') + '</pre></body></html>');
});

for (var i = 0; i < listening_ports.length; i++) {
    console.log('Starting to listen on "%s".', listening_ports[i]);
    if (localhost_only) {
        app.listen(listening_ports[i], 'localhost');
    } else {
        app.listen(listening_ports[i]);
    }
}
