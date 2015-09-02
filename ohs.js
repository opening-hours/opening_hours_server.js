#!/usr/bin/env nodejs
/* @license AGPLv3 <https://www.gnu.org/licenses/agpl-3.0.html>
 * @author Copyright (C) 2015 Robin Schneider <ypid@riseup.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* Required modules {{{ */
var express       = require('express');
var opening_hours = require('opening_hours');
var http          = require('http');
var fs            = require('fs');
/* }}} */

/* Parameter handling {{{ */
var optimist = require('optimist')
    .usage('Usage: $0 [options]')
    .describe('h', 'Display the usage')
    .describe('v', 'Verbose output')
    .describe('d', 'Debug output')
    .describe('c', 'Use cache file for subsequent requests (debug mode only. Cache will never be never invalidated)')
    .describe('p', 'TCP port to listen on')
    .describe('l', 'Bind to loopback only (only accept connections from localhost)')
    .describe('t', 'Overpass API timeout in seconds')
    .boolean(['v', 'd', 'l'])
    .default('t', 60)
    .demand('p')
    .alias('h', 'help')
    .alias('v', 'verbose')
    .alias('d', 'debug')
    .alias('c', 'cache')
    .alias('l', 'localhost-only')
    .alias('p', 'tcp-port')
    .alias('t', 'timeout');

var argv = optimist.argv;

if (argv.help) {
    optimist.showHelp();
    process.exit(0);
}

if (argv.debug) {
    console.log("Running in debug mode.");
    // console.log(JSON.stringify(argv, null, '    '));
} else if (argv.verbose) {
    console.log("Running in verbose mode.");
}

var listening_ports = [];
if (typeof argv['tcp-port'] === 'number') {
    listening_ports.push(argv['tcp-port']);
} else if (typeof argv['tcp-port'] === 'object') {
    for (var i = 0; i < argv['tcp-port'].length; i++) {
        port = argv['tcp-port'][i];
        console.log("value");
        if (typeof port === 'number') {
            listening_ports.push(port);
        } else {
            throw "Invalid port: " + port;
        }
    }
} else {
    throw "Invalid port: " + argv['tcp-port'];
}
/* }}} */

var app = express();

/* Constants {{{ */
var project_name   = 'opening_hours_server.js';
var repository_url = 'https://github.com/ypid/' + project_name;
var bbox_url_parms = ['s', 'w', 'n', 'e'];
var cache_file_for_overpass_answer = 'cache.json';
var filters = {
    'error': 0,
    'errorOnly': 1,
    'warnOnly': 2,
};
var nominatiomTestJSON = {"place_id":"44651229","licence":"Data \u00a9 OpenStreetMap contributors, ODbL 1.0. http:\/\/www.openstreetmap.org\/copyright","osm_type":"way","osm_id":"36248375","lat":"49.5400039","lon":"9.7937133","display_name":"K 2847, Lauda-K\u00f6nigshofen, Main-Tauber-Kreis, Regierungsbezirk Stuttgart, Baden-W\u00fcrttemberg, Germany, European Union","address":{"road":"K 2847","city":"Lauda-K\u00f6nigshofen","county":"Main-Tauber-Kreis","state_district":"Regierungsbezirk Stuttgart","state":"Baden-W\u00fcrttemberg","country":"Germany","country_code":"de","continent":"European Union"}};
/* }}} */

function parseOverpassAnswer(overpass_answer, filter_keyword, keys, res) {
    var current_oh_value;
    var current_oh_mode;

    overpass_answer.generator += ', modified by the ' + project_name;
    filtered_elements = [];

    var number_of_elements = overpass_answer.elements.length;
    for (var i = 0; i < number_of_elements; i++) {
        var tags = overpass_answer.elements[i].tags;
        var worst_problem_keyword_for_element = null;
        overpass_answer.elements[i].tag_problems = {};
        for (var key in tags) {
            if (keys.indexOf(key) != -1) {
                current_oh_value = tags[key];
                current_oh_mode  = 0; // Default value.

                var warnings;
                var crashed = true;
                try {
                    oh = new opening_hours(
                        current_oh_value,
                        nominatiomTestJSON,
                        {'tag_key': key, 'map_value': true }
                    );
                    warnings = oh.getWarnings();
                    crashed = false;
                } catch (err) {
                    crashed = err;
                }
                var worst_problem_keyword_for_tag = (crashed ? 'errorOnly' : (warnings.length > 0 ? 'warnOnly' : null ));
                overpass_answer.elements[i].tag_problems[key] = {
                    error: !!crashed,
                    eval_notes: (crashed ? [ crashed ] : warnings),
                };
                if (worst_problem_keyword_for_element === null || filters[worst_problem_keyword_for_tag] < filters[worst_problem_keyword_for_element]) {
                    worst_problem_keyword_for_element = worst_problem_keyword_for_tag;
                }
                if (argv.debug && overpass_answer.elements[i].tag_problems[key].eval_notes && overpass_answer.elements[i].tag_problems[key].eval_notes.length > 0) {
                    console.info(overpass_answer.elements[i].tag_problems[key].eval_notes);
                }
            }
        }
        if (filter_keyword === worst_problem_keyword_for_element || (filter_keyword === 'error' && typeof worst_problem_keyword_for_element === 'string')) {
            console.log("value");
            filtered_elements.push(overpass_answer.elements[i]);
        }
    }
    overpass_answer.elements = filtered_elements;
    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify(overpass_answer, null, '  '));
}

app.get('/api/oh_interpreter', function(req, res) {

    /* Error handling {{{ */
    var errors = [];

    /* Validate tag key {{{ */
    if (typeof req.query.tag === 'string') {
        if (!req.query.tag.match(/^[A-Za-z:_-]+$/)) {
            errors.push("Unusal OSM key");
        }
    } else {
        errors.push("OSM key is missing.");
    }
    /* }}} */

    /* Validate bonding box {{{ */
    var bbox_coordinates = [];
    for (var i = 0; i < bbox_url_parms.length; i++) {
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
    /* }}} */

    /* Validate filter {{{ */
    var filter_keyword = 'error';
    if (typeof req.query.filter === 'string') {
        if (typeof filters[req.query.filter] === 'number') {
            filter_keyword = req.query.filter;
        } else {
            errors.push("Invalid filter: " + req.query.filter);
        }
    }
    if (errors.length > 0) {
        var error_message = errors.join('<br>\n');
        console.info(error_message);
        res.status(400).send(error_message + '<br><br>\nSee <a href="' + repository_url + '">documentation</a>.');
        return;
    }
    /* }}} */

    /* }}} */

    /* Building the Overpass query {{{ */
    var components = [];
    var keys = req.query.tag.split(',');
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        components.push("node['" + key + "'];");
        components.push("way['" + key + "'];");
    }

    var OverpassQL = '[out:json]'
        + '[timeout:' + argv.timeout + ']'
        + '[bbox:' + bbox_coordinates.join(',') + '];'
        + '(' + components.join('') + ');'
        + 'out body center;';
    /* }}} */

    var overpass_answer;
    if (argv.cache && fs.existsSync(cache_file_for_overpass_answer)) {
        console.log("Got query from %s, satisfying from cache file. Answer might be not appropriate to request.", req.hostname);
        overpass_answer = JSON.parse(fs.readFileSync(cache_file_for_overpass_answer));
        parseOverpassAnswer(overpass_answer, filter_keyword, keys, res);
    } else {
        if (argv['localhost-only']) {
            console.log("%s: Executing query: %s", new Date(), OverpassQL);
        } else {
            console.log("%s: Executing query requested by %s: %s", new Date(), req.hostname, OverpassQL);
        }
        var encoded_json = '';
        var request = http.get({
            host: 'overpass-api.de',
            path: '/api/interpreter?data=' + encodeURIComponent(OverpassQL),
        }, function(response) {
            response.on('data', function(data) {
                encoded_json += data.toString();
            });
            response.on('end', function() {
                overpass_answer = JSON.parse(encoded_json);
                parseOverpassAnswer(overpass_answer, filter_keyword, keys, res);
                if (argv.cache) {
                    fs.writeFile(cache_file_for_overpass_answer, encoded_json, function(err) {
                        if (err) {
                            throw err;
                        }
                    });
                }
            });
        }).on('error', function(err) {
             throw("Got error: " + err.message);
        });
    }
});

app.get('/api/get_license', function(req, res) {
    res.send('<html><head><title>LICENSE</title></head><body><pre>' + fs.readFileSync('LICENSE') + '</pre></body></html>');
});

app.get('/api', function(req, res) {
    res.send('<html><head><title>Documentation</title></head><body><p>You can find the README together with the source code <a href="' + repository_url + '">on Github</a>.'
        + '</p></body></html>');
});

for (var i = 0; i < listening_ports.length; i++) {
    console.log('Starting to listen on "%s".', listening_ports[i]);
    if (argv['localhost-only']) {
        console.log("Binding on loopback device only.");
        app.listen(listening_ports[i], 'localhost');
    } else {
        app.listen(listening_ports[i]);
    }
}
