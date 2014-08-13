var util = require('util');
var https=require('https');
var Client = require('node-rest-client').Client;
var fs = require('fs');
var accesstoken = fs.readFileSync("./accesstoken.txt");
var baseURL = "https://api.compose.io";

var headers = {
  "Content-Type": "application-json",
  "Accept-Version": "2014-06",
  "Authorization": "Bearer " + accesstoken
}

var httpArgs = {
  "headers": headers
}

var client = new Client();

if (process.argv.length != 3) {
  console.log("Need a deployment name to backup");
  process.exit(1);
}

var deployment = process.argv[2];
var accountslug = "";
var backupid = "";
var timeoutTimer;
// We will assume that the lead account is the one to use for backups

client.get(util.format("%s/accounts", baseURL), httpArgs,
  function(accounts, response) {
    if (response.statusCode != 200) {
      if (accounts.hasOwnProperty("error")) {
        res.send(accounts.error);
      } else {
        res.send(response.headers.status);
      }
      return;
    }

    accountslug = accounts[0].slug;

    client.post(util.format("%s/deployments/%s/%s/backups", baseURL,
      accountslug, deployment), httpArgs, function(backup, response) {
      if (response.statusCode != 201) {
        if (accounts.hasOwnProperty("error")) {
          console.log(accounts.error);
        } else {
          console.log(response.headers.status);
          console.log(backup.error);
        }
        return;
      }
      backupid = backup.id;
      console.log("Backup started for "+backupid)
      timerTimeout = setTimeout(backupReady, 15 * 1000);
    });
  });


function backupReady() {
  clearTimeout(timerTimeout);
  client.get(util.format("%s/accounts/%s/backups/%s", baseURL,
    accountslug, backupid), httpArgs, function(backup, response) {
    if (backup.status === "complete") {
      console.log("Backup completed");
      console.log("Now to retrieve ");
      for(var i=0; i<backup.links.length;i++) {
        link=backup.links[i];
        if(link.rel=="download") {
          console.log("Will get link from "+link.href);
          client.get(link.href,httpArgs, function(doc,response) {
            download(response.headers.location, backup.filename, function() {
              console.log("Download complete");
            } );
          });
        }
      }
    } else {
      timerTimeout = setTimeout(backupReady, 15 * 1000);
    }
  })
};

var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  console.log(url);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);
    });
  });
}
