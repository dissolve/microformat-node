'use strict';
require('dotenv').config();
const Hapi = require('hapi');
const Joi = require('joi');
const Inert = require('inert');
const Vision = require('vision');
const Blipp = require('blipp');
const RequestPromise = require('request-promise');
const Handlebars = require('handlebars');
const Pack = require('./package.json');
const Microformats = require('./index.js');


const internals = {};

internals.schema = {
    payload: {
        url: Joi.string(),
        html: Joi.string()
            .description('The html to parse'),
        baseUrl: Joi.string()
            .allow('')
            .description('Optional URL to help resolve relative links'),
        filters: Joi.string()
            .allow('')
            .description('Optional comma separted list of formats to filter by'),
        overlappingVersions: Joi.boolean(),
        impliedPropertiesByVersion: Joi.boolean(),
        parseLatLonGeo: Joi.boolean(),
        dateFormat: Joi.string(),
        textFormat: Joi.string()
    }
}


const rootHandler = (request, h) => {

    return h.view('index', {
        title: Pack.name,
        version: Pack.version,
    });
};


function parseHTML(request, h) {

    return buildOptions(request,h, 'get');

}


function countHTML(request, h) {

    return buildOptions(request,h, 'count');
}



// create options from form input
function buildOptions(request, h, parse_type = 'get') {

    let options = {};
    let err = null;

    if (request.payload.html !== undefined) {
        options.html = request.payload.html.trim();
    }

    if (request.payload.baseUrl !== undefined) {
        options.baseUrl = request.payload.baseUrl.trim();
    }

    if (request.payload.filters !== undefined) {
        if (request.payload.filters.indexOf(',') > -1) {
            options.filters = trimArray(request.payload.filters.split(','))
        } else {
            options.filters = trimArray(request.payload.filters)
        }
        if (options.filters.length === 0) {
            delete options.filters;
        }
    }

    if (request.payload.dateFormat !== undefined) {
        options.dateFormat = request.payload.dateFormat;
    }

    if (request.payload.textFormat !== undefined) {
        options.textFormat = request.payload.textFormat;
    }

    if (request.payload.overlappingVersions !== undefined) {
        options.overlappingVersions = request.payload.overlappingVersions
    }

    if (request.payload.impliedPropertiesByVersion !== undefined) {
        options.impliedPropertiesByVersion = request.payload.impliedPropertiesByVersion
    }

    if (request.payload.parseLatLonGeo !== undefined) {
        options.parseLatLonGeo = request.payload.parseLatLonGeo
    }


    if (request.payload.url !== undefined) {

        return RequestPromise(request.payload.url)
            .then(function (body) {
                options.html = body;
                if(parse_type == 'count'){
                    var mfObj = Microformats.count(options);
                } else {
                    var mfObj = Microformats.get(options);
                }

                const response = h.response(JSON.stringify(mfObj));
                response.type('application/json');
                return response;

            })
            .catch(function (err) {
                const response = h.response({err: err});
                response.type('application/json');
                return response;

            });
        
    }else{
        if(parse_type == 'count'){
            var mfObj = Microformats.count(options);
        } else {
            var mfObj = Microformats.get(options);
        }
        const response = h.response(JSON.stringify(mfObj));
        response.type('application/json');
        return response;
    }

}


function trimArray(obj) {
    let out = [];
    if (Array.isArray(obj)) {
        obj.forEach(function (txt) {
            if (obj.trim() !== '') {
                out.push(obj.trim())
            }
        });
    } else {
        if (obj.trim() !== '') {
            out.push(obj.trim())
        }
    }
    return out;
}


// options for good reporting
const goodOptions = {
    ops: {
        interval: 1000
    },
    reporters: {
        myConsoleReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ log: '*', response: '*' }]
        }, {
            module: 'good-console'
        }, 'stdout']
    }
}

internals.main = async () => {

    // Create a server with a host and port
    var server = new Hapi.Server({
        host: (process.env.PORT) ? '0.0.0.0' : 'localhost',
        port: parseInt(process.env.PORT, 10) || 3001,
        router: {
            stripTrailingSlash: true
        },
        routes: { cors: true }
    });

    // Register plug-in and start
    await server.register(Inert);
    await server.register(Vision);
    await server.register(Blipp)
    await server.register({plugin: require('good'),
        options: goodOptions
        });

    await server.start()
    
    console.info('Server started at ' + server.info.uri);


    // add templates support with handlebars
    server.views({
        engines: { html: Handlebars },
        relativeTo: __dirname,
        path: `templates`
    });

    // setup routes to serve the test directory and file routes into other modules
    server.route([{
        method: 'GET',
        path: '/',
        handler: rootHandler,
    }, {
        method: 'POST',
        path: '/parse',
        config: {
            handler: parseHTML,
            validate: internals.schema
        }
    }, {
        method: 'POST',
        path: '/count',
        config: {
            handler: countHTML,
            validate: internals.schema
        }
    }, {
        method: 'GET',
        path: '/{path*}',
        handler: {
            directory: {
                path: './static'
            }
        }
    }]);
};

internals.main();
