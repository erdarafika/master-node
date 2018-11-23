var server = require('http').createServer();
var io = require('socket.io')(server);
var SHA256 = require("crypto-js/sha256")
var PouchDB = require("pouchdb")
PouchDB.plugin(require('pouchdb-find'))
var block = new PouchDB('blocks')
var txs = new PouchDB('txs')
var account = new PouchDB('account')

// block.destroy().then(function (response) {
//   console.log(response);
// }).catch(function (err) {
//   console.log(err);
// })

function calculateHash(data) {
   return SHA256(data.height + data.previousBlockHash + data.txs + data.isMainNet + data.timeStamp).toString();
}

block.createIndex({
   index: {
      fields: ['height', 'hash', 'previousblockhash']
   }
}).then(function(result) {
   console.log(result);
}).catch(function(err) {
   console.log(err);
});

io.on('connection', function(socket) {
   // emit latestblock on connection
   block.find({
      selector: {
         height: {
            '$gte': null
         }
      },
      sort: [{
         height: 'desc'
      }],
      limit: 1
   }).then(function(doc) {
      console.log(doc.docs)
      io.emit('latestblock', doc.docs)
   }).catch(function(err) {

   })

   socket.on('disconnect', function() {
      // disconnect
   });

   socket.on('syncblock', function(data) {
      block.find({
         selector: {
            height: {
               '$gte': data.height
            }
         },
         sort: [{
            height: 'desc'
         }]
      }).then(function(doc) {
         if (doc.docs.length > 0) {
            socket.emit('syncblock', doc)
         }
      }).catch(function(err) {

      })
   })

   socket.on('newblock', function(data) {
      console.log(data);
      delete data['_rev_tree']
      delete data['_rev']
      block.find({
         selector: {
            height: data.height - 1
         }
      }).then(function(doc) {
         if (doc.docs.length > 0) {
            var hash = doc.docs[0].hash
            if (data.hash == calculateHash(data) && data.previousBlockHash == hash) {
               block.post(data).then(function(response) {
                  socket.emit('latestblock', data)
               }).catch(function(err) {

               });
            }
         }
         if (doc.docs.length == 0) {
            block.post(data).then(function(response) {
               socket.emit('latestblock', data)
            }).catch(function(err) {

            });
         }
      }).catch(function(err) {

      });
   })

   socket.on('upblock', function(data) {
      for (var i = 0; i < data.docs.length; i++) {
         if (i == data.docs.length - 1) {
            break
         }
         if (data.docs[i].hash == calculateHash(data.docs[i]) && data.docs[i].previousBlockHash == calculateHash(data.docs[i + 1])) {
            delete data.docs[i]['_rev_tree']
            delete data.docs[i]['_rev']
            block.post(data.docs[i]).then(function(response) {

            }).catch(function(err) {

            });
         } else {
            break
         }
      }
   })
});
server.listen(3000);
