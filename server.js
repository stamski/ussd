var http = require('http');
var path = require('path');
var fs = require('fs');
var ussd = require('./modules/ussd');

var host = '127.0.0.1';
var port = 3000;

http.createServer(function(req, res){
  if (req.method !== 'GET') {
    if(req.method == 'POST' && req.url.indexOf('ussd') !== -1) {
      ussd(req, res);
    } else {
      res.writeHead(405);
      res.end('Unsupported request method', 'utf8');
    }
  } else {
    var filePath = './public' + ((!req.url || req.url == '/' || req.url == '') ? '/index.html' : req.url);
    fs.exists(filePath, function(file){
      if (!file) { 
        res.writeHead(404);
        res.write('req.url: ' + req.url);
        res.write('\nfilePath: '+filePath);
        res.write('\nfile not found');
        res.end(); 
      } else {
        var stream = fs.createReadStream(filePath);
        var mimeTypes = {'.js' : 'text/javascript','.css' : 'text/css', '.html' : 'text/html'};

        stream.on('error', function(error) {
          res.writeHead(500);
          res.end();
          return;
        });

        res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'text/plain');
        res.writeHead(200);

        stream.pipe(res, function(err) {
            if(err)
              console.log(err);
            res.end();
        });
      }
    });
  }
}).listen(port, host);
console.log('Server running at http://'+host+':'+port+'/');