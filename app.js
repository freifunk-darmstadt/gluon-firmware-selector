/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


var config = {
  typeNames: {
    'factory': 'Erstinstallation',
    'sysupgrade': 'Upgrade'
  },
  // relative image paths and branch
  directories: {
    // some demo sources
    './images/gluon-factory.html': 'stable',
    './images/gluon-sysupgrade.html': 'stable'
  }
};

function $(s) {
  return document.getElementById(s.substring(1));
}

function toggleDisplay(id) {
  var e = $(id);
  e.style.display = (e.style.display == 'none') ? 'block' : 'none'
}

function show_inline(e) {
  $(e).style.display = 'inline-block';
}

function show_block(e) {
  $(e).style.display = 'block';
}

function hide(e) {
  $(e).style.display = 'none';
}

// Object.values() replacement
function ObjectValues(obj) {
  return Object.keys(obj).map(function(key) { return obj[key]; });
}

function isEmptyObject(obj) {
    for (var name in obj) {
        return false;
    }
    return true;
}

var firmwarewizard = function() {
  var app = {};

  var IGNORED_ELEMENTS = ['-kernel', '-rootfs', '-tftp', '-16M-', '-fat', '-loader', '-il-', '-NA', '-x2-', '-hsv2'];
  var PANE = {'MODEL': 0, 'IMAGETYPE': 1, 'BRANCH': 2};

  var wizard = parseWizardObject();
  app.currentVersions = {};
  var images = {};

  function buildVendorModelsReverse() {
    var vendormodels_reverse = {}

    // create a map of {match : [{vendor, model, default-revision}, ... ], ...}
    for (var vendor in vendormodels) {
      var models = vendormodels[vendor];
      for (var model in models) {
        var match = models[model];
        if (typeof match == 'string') {
          addArray(vendormodels_reverse, match, {'vendor': vendor, 'model': model, 'revision': ''});
        } else for (var m in match) {
          addArray(vendormodels_reverse, m, {'vendor': vendor, 'model': model, 'revision': match[m]});
        }
      }
    }

    return vendormodels_reverse;
  }

  function createHistoryState(wizard) {
    if (!window.history || !history.pushState) return;

    var parameters = '';
    for (var key in wizard) {
      parameters += '&' + key + '=' + encodeURIComponent(wizard[key]);
    }

    // replace first occurence of "&" by "?"
    parameters = parameters.replace('&', '?');
    history.pushState(wizard, '', parameters);
  }

  function parseWizardObject(wizard) {
    if (wizard === undefined || wizard === null) wizard = {};
    wizard.vendor            = wizard.vendor || -1;
    wizard.model             = wizard.model || -1;
    wizard.revision          = wizard.revision || -1;
    wizard.imageType         = wizard.imageType || -1;
    wizard.showFirmwareTable = (wizard.showFirmwareTable == 'true');
    return wizard;
  }

  window.onpopstate = function(event) {
    if (event.state === null) return;
    wizard = parseWizardObject(event.state);
    updateHTML(wizard);
  }

  window.onload = function() {
    function parseURLasJSON() {
      var search = location.search.substring(1);
      return search ? JSON.parse(
        '{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
        function(key, value) {
          return (key=== '') ? value:decodeURIComponent(value);
        }):{};
    }
    var parsedURL = parseURLasJSON();
    wizard = parseWizardObject(parsedURL);
    updateHTML(wizard);
  }

  app.genericError = function() {
    alert('Da ist was schiefgelaufen. Frage doch bitte einmal im Chat nach.');
  };

  // methods to set options

  app.setVendor = function(vendor) {
    wizard.vendor = vendor;
    wizard.model = -1;
    wizard.revision = -1;
    wizard.imageType = -1;
    createHistoryState(wizard);
    updateHTML(wizard);
  };

  app.setModel = function(model) {
    wizard.model = model;
    wizard.revision = -1;
    wizard.imageType = -1;

    if (wizard.model != -1) {
      // skip revision selection if there is only one option left
      var revisions = getRevisions();
      if (revisions.length == 1) {
        app.setRevision(revisions[0], true);
      }
    }

    createHistoryState(wizard);
    updateHTML(wizard);
  };

  app.setRevision = function(revision, silentUpdate) {
    if (silentUpdate === undefined) {
      silentUpdate = false;
    }
    wizard.revision = revision;
    wizard.imageType = -1;
    if (!silentUpdate) {
      createHistoryState(wizard);
      updateHTML(wizard);
    }
  };

  app.setImageType = function(type) {
    wizard.imageType = type;
    createHistoryState(wizard);
    updateHTML(wizard);
  };

  app.showFirmwareTable = function() {
    wizard.showFirmwareTable = true;
    createHistoryState(wizard);
    updateHTML(wizard);
  }

  app.hideFirmwareTable = function() {
    wizard.showFirmwareTable = false;
    createHistoryState(wizard);
    updateHTML(wizard);
  }

  // exclude file names containing a string
  function isValidFileName(name) {
    for (var i in IGNORED_ELEMENTS) {
      if (name.indexOf(IGNORED_ELEMENTS[i]) != -1) {
        return false;
      }
    }
    return true;
  }

  // simplified version string sort
  function sortByRevision(revisions) {
    revisions.sort(function(a, b) {
        a = a.revision; b = b.revision;
        if (a.length > b.length) return 1;
        if (a.length < b.length) return -1;
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      });
    return revisions;
  }

  function findType(name) {
    return (name.indexOf('sysupgrade') != -1) ? 'sysupgrade' : 'factory';
  }

  function findVersion(name) {
    // version with optional date in it (e.g. 0.8.0~20160502)
    var m = /-([0-9]+.[0-9]+.[0-9]+(~[0-9]+)?)-/.exec(name);
    return m ? m[1] : '';
  }

  function findRevision(name) {
    // reversion identifier like a1, v2
    var m =/-([a-z][0-9]+(.[0-9]+)?)[.-]/.exec(name);
    return m ? m[1] : 'alle';
  }

  function findRegion(name) {
    var m =/-(eu|cn|de|jp|us)[.-]/.exec(name);
    return m ? m[1] : '';
  }

  function addArray(obj, key, value) {
    if (key in obj) {
      obj[key].push(value);
    } else {
      obj[key] = [value];
    }
  }

  function parseFilePath(device, match, path, href, branch) {
    if (!isValidFileName(href)) {
      return;
    }

    if (device.model == '--ignore--') {
      return;
    }

    var location = path + href;
    var type = findType(href);
    var version = findVersion(location);
    var region = findRegion(href);
    var revision = device.revision;

    if (revision.length == 0) {
      revision = findRevision(href.replace(match, ''));
    }

    if (region.length) {
      revision += '-' + region;
    }

    // collect branch versions
    app.currentVersions[branch] = version;

    if (!(device.vendor in images)) {
      images[device.vendor] = {};
    }

    addArray(images[device.vendor], device.model, {
      'revision': revision,
      'branch': branch,
      'type': type,
      'version': version,
      'location': location
    });
  }

  function createOption(value, title, selectedOption) {
    var o = document.createElement('option');
    o.value = value;
    o.innerHTML = title;
    o.selected = (value === selectedOption);
    return o;
  }

  function getRevisions() {
    return sortByRevision(images[wizard.vendor][wizard.model])
      .map(function(e) { return e.revision; })
      .filter(function(value, index, self) { return self.indexOf(value) === index; });
  }

  function getImageTypes() {
    return images[wizard.vendor][wizard.model]
      .map(function(e) { return e.type; })
      .filter(function(value, index, self) { return self.indexOf(value) === index; })
      .sort();
  }

  // update all elements of the page according to the wizard object.
  function updateHTML(wizard) {
    if (wizard.showFirmwareTable) {
      show_block('#firmwareTable');
      hide('#wizard');
    } else {
      show_block('#wizard');
      hide('#firmwareTable');
    }

    // show vendor dropdown menu.
    function showVendors() {
      var select = $('#vendorselect');
      select.innerHTML = '';
      select.appendChild(
        createOption(-1, '-- Bitte Hersteller wählen --')
      );

      var vendors = Object.keys(images).sort();
      for (var i in vendors) {
        select.appendChild(
          createOption(vendors[i], vendors[i], wizard.vendor)
        );
      }
    }
    showVendors();

    // show model dropdown menu
    function showModels() {
      var select = $('#modelselect');

      select.innerHTML = '';
      select.appendChild(
        createOption(-1, '-- Bitte Modell wählen --')
      );

      if (wizard.vendor == -1 || isEmptyObject(images)) {
        return;
      }

      var models = Object.keys(images[wizard.vendor]).sort();
      for (var i in models) {
          select.appendChild(
            createOption(models[i], models[i], wizard.model)
          );
      }
    }
    showModels();

    // show revision dropdown menu
    function showRevisions() {
      var select = $('#revisionselect');

      select.innerHTML = '';

      select.appendChild(
        createOption(-1, '-- Bitte Hardwarerevision wählen --', wizard.revision)
      );

      if (wizard.vendor  == -1 || wizard.model == -1 || isEmptyObject(images)) {
        return;
      }

      var revisions = getRevisions();
      for (var i in revisions) {
        select.appendChild(
          createOption(revisions[i], revisions[i], wizard.revision)
        );
      }
    }
    showRevisions();

    // show image type selection
    function showImageTypes() {
      if (wizard.model == -1 || isEmptyObject(images)) {
        return;
      }

      var content = '';
      var types = getImageTypes();
      for (var i in types) {
        var type = types[i];
        var displayType = config.typeNames[type] || type;
          content += '<input type="radio" id="radiogroup-typeselect-'
          + type + '" ' + ((type == wizard.imageType) ? 'checked ' : '')
          + 'name="firmwareType" onclick="firmwarewizard.setImageType(\'' + type + '\');">'
          + '<label for="radiogroup-typeselect-' + type + '">' + displayType + '</label>';
      }
      $('#typeselect').innerHTML = content;
    }
    showImageTypes();

    // show branch selection
    function showBranches() {
      if (wizard.model == -1 || wizard.revision == -1 || wizard.imageType == -1 || isEmptyObject(images)) {
        return;
      }

      var revisions = images[wizard.vendor][wizard.model]
        .filter(function(e) { return e.revision == wizard.revision && e.type == wizard.imageType; });

      $('#branchselect').innerHTML = '';
      $('#branch-experimental-dl').innerHTML = '';

      for (var i in revisions) {
        var rev = revisions[i];
        if (rev.branch == 'experimental') {
          $('#branchselect').innerHTML = '<button class="btn abutton dl-expermental" onclick="toggleDisplay(\'#warning-experimental\');">'+rev.branch+' (' +rev.version+')</button>';
          $('#branch-experimental-dl').innerHTML = '<a href="'+rev.location+'" class="abutton">Download für Experimentierfreudige</a>';
        } else {
          $('#branchselect').innerHTML = '<a href="'+rev.location+'" class="abutton">'+rev.branch+' (' +rev.version+')</a>';
        }
      }
    }
    showBranches();

    function updateHardwareSelection() {
      if (wizard.vendor == -1) {
        hide('#modelselect');
        hide('#revisionselect');
      } else {
        show_inline('#modelselect');
        if (wizard.model == -1) {
          hide('#revisionselect');
        } else {
          show_inline('#revisionselect');
        }
      }
    }
    updateHardwareSelection();

    function updatePanes() {
      var pane = PANE.MODEL;
      if (wizard.vendor != -1 && wizard.model != -1 && wizard.revision != -1) {
        pane = PANE.IMAGETYPE;
        if (wizard.imageType != -1) {
          pane = PANE.BRANCH;
        }
      }

      $('#model-pane').style.display = (pane >= PANE.MODEL) ? 'block' : 'none';
      $('#type-pane').style.display = (pane >= PANE.IMAGETYPE) ? 'block' : 'none';
      $('#branch-pane').style.display = (pane >= PANE.BRANCH) ? 'block' : 'none';
    }
    updatePanes();

    function updateFirmwareTable() {
      var branches = ObjectValues(config.directories)
        .filter(function(value, index, self) { return self.indexOf(value) === index; })
        .sort();

      $('#currentVersions').innerHTML = branches.reduce(function(ret, branch, i) {
        ret += ((i == 0) ? '' : ' // ') + branch;
        ret += (branch in app.currentVersions) ?  (': '  + app.currentVersions[branch]) : '';
        return ret;
      }, '');

      $('#firmwareTableBody').innerHTML = '';

      var lines = '';
      var vendors = Object.keys(images).sort();
      for (var v in vendors) {
        var vendor = vendors[v];
        var models = Object.keys(images[vendor]).sort();
        for (var m in models) {
          var model = models[m];
          var revisions = sortByRevision(images[vendor][model]);

          var upgradeHTML = {
            'stable': '',
            'beta': '',
            'experimental': ''
          };

          var factoryHTML = {
            'stable': '',
            'beta': '',
            'experimental': ''
          };

          for (var r in revisions) {
            var rev = revisions[r];
            var html = '[<a href="' + rev.location + '" title="' + rev.version + '">' + rev.revision + '</a>] ';
            if (rev.type == 'sysupgrade') {
              upgradeHTML[rev.branch] += html;
            } else if (rev.type == 'factory') {
              factoryHTML[rev.branch] += html;
            } else {
              //kernel?
              app.genericError();
            }
          }

          var showStable = (upgradeHTML.stable !== '') || (factoryHTML.stable !== '');
          var showBeta = (upgradeHTML.beta !== '') || (factoryHTML.beta !== '');
          var showExperimental = (upgradeHTML.experimental !== '') || (factoryHTML.experimental !== '');

          lines += '<tr><td>' + vendor + '</td><td>' + model + '</td><td>';

          if (showStable) {
            lines += 'stable: ' + (factoryHTML.stable || '-') + '<br>';
          }

          if (showBeta) {
            lines += 'beta: ' + (factoryHTML.beta || '-') + '<br>';
          }

          if (showExperimental) {
            lines += 'experimental: ' + (factoryHTML.experimental || '-');
          }

          lines += '</td><td>';

          if (showStable) {
            lines += 'stable: ' + (upgradeHTML.stable || '-') + '<br>';
          }

          if (showBeta) {
            lines += 'beta: ' + (upgradeHTML.beta || '-') + '<br>';
          }

          if (showExperimental) {
            lines += 'experimental: ' + (upgradeHTML.experimental || '-');
          }

          lines += '</td></tr>';
        }
      }
      $('#firmwareTableBody').innerHTML = lines;
    }
    updateFirmwareTable();
  }

  function loadSite(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        callback(xmlhttp.responseText, url);
      }
    }
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
  }

  // parse the contents of the given directories
  function loadDirectories() {
    var vendormodels_reverse = buildVendorModelsReverse();

    // sort by length to get the longest match
    var matches = Object.keys(vendormodels_reverse).sort(function(a, b) {
      if (a.length < b.length) return 1;
      if (a.length > b.length) return -1;
      return 0;
    });

    // create regex for extracting image paths
    var re = new RegExp('"([^"]*(' + matches.join('|') + ')[-.][^"]*)"', 'g');

    for (var indexPath in config.directories) {
      // retrieve the contents of the directory
      loadSite(indexPath, function(data, indexPath) {
        re.lastIndex = 0; // reset regex
        var m;

        do {
          m = re.exec(data);
          if (m) {
            var href = m[1];
            var match = m[2];
            var basePath = indexPath.substring(0, indexPath.lastIndexOf('/') + 1);
            var branch = config.directories[indexPath];
            var devices = vendormodels_reverse[match];

            for (var i in devices) {
              parseFilePath(devices[i], match, basePath, href, branch);
            }
          }
        } while (m);

        /*
        var el = document.createElement('html');
        el.innerHTML = data;
        var as = el.getElementsByTagName('a');
        */

        updateHTML(wizard);
      });
    }
  }

  loadDirectories();

  return app;
}();
