var util = require('util');
var https = require('https');
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


if (process.argv.length == 3) {

  var deployment = process.argv[2];
  var accountslug = "";
  var backupId = "";
  var timeoutTimer;

  getAccount(function(err, slug) {
    exitIfErr(err, "Could not get account");
    accountslug = slug;
    client.post(util.format("%s/deployments/%s/%s/backups", baseURL,
      accountslug, deployment), httpArgs, function(backup, response) {
      if (response.statusCode != 201) {
        console.log(backup.error + " (" + response.headers.status + ")");
        process.exit(1);
      }
      backupId = backup.id;
      console.log("Backup started for with id=" + backupId)
      timerTimeout = setTimeout(backupReady, 15 * 1000);
    });
  });
} else {
  if (process.argv.length != 2) {
    console.log("Just need a deployment name to backup");
    process.exit(1);
  }

  getAccount(function(err, slug) {
    exitIfErr(err, "Could not get account");
    client.get(util.format("%s/accounts/%s/deployments", baseURL, slug),
      httpArgs, function(deployments, response) {
        exitIfErr(err, "Could not get deployments");
        console.log(
          "You need to give a deployment as a parameter to this command");
        console.log("Available deployments are:");
        for (var i = 0; i < deployments.length; i++) {
          if (deployments[i].name == "") {
            console.log(deployments[i].id);
          } else {
            console.log(deployments[i].name);
          }
        }
        process.exit(0);
      });
  });
}

function backupReady() {
  clearTimeout(timerTimeout);
  client.get(util.format("%s/accounts/%s/backups/%s", baseURL,
    accountslug, backupId), httpArgs, function(backup, response) {
    if (backup.status === "complete") {
      console.log("Backup completed - now retrieving: " + backup.filename);
      for (var i = 0; i < backup.links.length; i++) {
        link = backup.links[i];
        if (link.rel == "download") {
          client.get(link.href, httpArgs, function(doc, response) {
            download(response.headers.location, backup.filename, function() {
              console.log("Download complete");
            });
          });
        }
      }
    } else {
      timerTimeout = setTimeout(backupReady, 15 * 1000);
    }
  })
};

function getAccount(callback) {
  client.get(util.format("%s/accounts", baseURL), httpArgs,
    function(accounts, response) {
      if (response.statusCode != 200) {
        if (accounts.hasOwnProperty("error")) {
          callback(accounts.error, null);
        } else {
          callback(response.headers.status, null);
        }
        return;
      }
      callback(null, accounts[0].slug);
    })
}

function exitIfErr(err, message) {
  if (err != null) {
    console.log(message + ": " + err);
    process.exit(1);
  }
}

var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);
    });
  });
}
