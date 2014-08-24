#!/usr/bin/env node

var express       = require('express');
var opening_hours = require('opening_hours');
var http          = require('http');
var fs            = require('fs');

var app = express();

var project_name   = 'opening_hours_server.js';
var repository_url = 'https://github.com/ypid/' + project_name;
var bbox_url_parms = ['s', 'w', 'n', 'e'];
var debug = false;
var listening_ports = [];
var cache_file_for_overpass_answer = 'cache.json';
var problem_code_to_problem = ['ok', 'warning', 'error'];
var filters = ['error', 'errorOnly', 'warnOnly'];

/* Parameter parsing {{{ */
var args = process.argv.splice(2);
for (var i = 0; i < args.length; i++) {
    if (args[i] === '-d' || args[i] === '--debug') {
        console.log("Running in debug mode.");
        debug = true;
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
/* }}} */


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
    var filter;
    if (typeof req.query.filter === 'string') {
        if (filters.indexOf(req.query.filter) === -1) {
            errors.push("Invalid filter: " + req.query.filter);
        } else {
            filter = filters.indexOf(req.query.filter);
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

    var OverpassQL = '[out:json][timeout:3][bbox:' + bbox_coordinates.join(',') + '];(' + components.join('') + ');out body center;';
    console.log(OverpassQL);

    var options = {
        host: 'overpass-api.de',
        path: '/api/interpreter?data=' + encodeURIComponent(OverpassQL),
    };

    // if (!fs.existsSync(cache_file_for_overpass_answer)) {
        // var file = fs.createWriteStream(cache_file_for_overpass_answer);
        // var request = http.get(options, function(response) {
            // response.pipe(file);
        // }).on('error', function(err) {
             // throw("Got error: " + err.message);
        // });
    // }
    fs.readFile(cache_file_for_overpass_answer, 'utf8', function (err, data) {
        overpass_answer = JSON.parse(data);

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
                        oh = new opening_hours(tags[key]);
                        warnings = oh.getWarnings();
                        crashed = false;
                    } catch (err) {
                        crashed = true;
                    }
                    var problem = (crashed ? 2 : (warnings.length > 0 ? 1 : 0));
                    overpass_answer.elements[i].tag_problems[key] = problem_code_to_problem[problem];
                    if (typeof worst_problem === 'undefined' || problem > worst_problem) {
                        worst_problem = problem;
                    }
                }
            }
            console.log("filter %d, worst %d", filter, worst_problem);
            if (filter < worst_problem)
                filtered_elements.push(overpass_answer.elements[i]);
        }
        overpass_answer.elements = filtered_elements;
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(overpass_answer, null, '  '));
    });

    // var overpass_request = http.get(translation_source, function(response) {
        // response.pipe(file);
    // }).on('error', function(err) {
         // throw("Got error: " + err.message);
    // });
});

for (var i = 0; i < listening_ports.length; i++) {
    console.log('Starting to listen on "%s".', listening_ports[i]);
    app.listen(listening_ports[i]);
}
