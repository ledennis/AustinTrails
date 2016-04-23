#!/bin/env node
var express = require('express');
var fs      = require('fs');
var request = require('request');

var trailData;
var TrailApp = function() {

    var self = this;

    self.setupVariables = function() {
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        }
    };

    /** Populate the cache **/
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };
    self.cache_get = function(key) { return self.zcache[key]; };

    /** Handle server termination **/
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       new Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', new Date(Date.now()) );
    };
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element) {
            process.on(element, function() { self.terminator(element); });
        });
    };

    /** Routing table entries and handlers **/
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };

    /** Initialize server **/
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();

        self.app.use(express.static(__dirname + '/'));

        self.app.use(express.static(__dirname + '/assets'));

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            //noinspection JSUnfilteredForInLoop
            self.app.get(r, self.routes[r]);
        }
    };
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();
        self.initializeServer();

        // parse JSON
        request(trailDataUrl, function(err, trails, body) {
            if(err)                          console.err(err);
            // else if(trails.statusCode != 200) console.err(trails.statusCode + ' in trail request');
            else {
                trailData = JSON.parse(body);
                trailData.forEach(function(trail) {
                    trail.properties.trail_name = eval("(" + trail.properties.trail_name + ")"); 
                });
            }
        });
    };

    /** Start the server **/
    self.start = function() {
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        new Date(Date.now() ), self.ipaddress, self.port);
        });
    };
};

/** JSON stuff **/
var trailDataUrl = "https://raw.githubusercontent.com/ledennis/Parks-and-Recreations/master/traildataJSON.json";

var trailApp = new TrailApp();
trailApp.initialize();
trailApp.start();

trailApp.app.get('/trailnames', function(req, res) {
    var trailNames = [];
    trailData.forEach(function(trail) {
        trailNames.push(trail.properties.trail_name);
    });
    res.send(trailNames);
});

trailApp.app.get('/trailcoords', function(req, res) {
    var trailCoords = [];
    trailData.forEach(function(trail) {
       trailCoords.push({
           name: trail.properties.trail_name,
           latitude: trail.geometry.coordinates[0][0],
           longitude: trail.geometry.coordinates[0][1]})
    });
    res.send(trailCoords);
});

trailApp.app.get('/traildata/:trailname', function(req, res) {
    trailData.forEach(function(trail) {
        if(trail.properties.trail_name === req.params.trailname)
            res.json(trail);
    });
});