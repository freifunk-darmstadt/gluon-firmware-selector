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

function $(s) {
  return document.querySelector(s);
}

function toggleClass(s, cssClass) {
  $(s).classList.toggle(cssClass);
}

function show_inline(s) {
  $(s).style.display = 'inline-block';
}

function show_block(s) {
  $(s).style.display = 'block';
}

function hide(s) {
  $(s).style.display = 'none';
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

function scrollDown() {
  window.scrollBy({
    top: 512,
    left: 0,
    behavior: 'smooth'
  });
}

var firmwarewizard = function() {
  var app = {};

  var IGNORED_ELEMENTS = [
    './', '../', 'experimental.manifest', 'beta.manifest', 'stable.manifest',
    '-tftp', '-fat', '-loader', '-NA', '-x2-', '-hsv2', '-p1020'
  ];
  var PANE = {'MODEL': 0, 'IMAGETYPE': 1, 'BRANCH': 2};

  var wizard = parseWizardObject();
  app.currentVersions = {};
  var images = {};

  function buildVendorModelsReverse() {
    var vendormodels_reverse = {};

    // create a map of {match : [{vendor, model, default-revision}, ... ], ...}
    for (var vendor in config.vendormodels) {
      var models = config.vendormodels[vendor];
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
  };

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
  };

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
  };

  app.hideFirmwareTable = function() {
    wizard.showFirmwareTable = false;
    createHistoryState(wizard);
    updateHTML(wizard);
  };

  // exclude file names containing a string
  function ignoreFileName(name) {
    for (var i in IGNORED_ELEMENTS) {
      if (name.indexOf(IGNORED_ELEMENTS[i]) != -1) {
        return true;
      }
    }
    return false;
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
    var m = /-(sysupgrade|factory|rootfs|kernel)[-.]/.exec(name);
    return m ? m[1] : 'factory';
  }

  function findVersion(name) {
    // version with optional date in it (e.g. 0.8.0~20160502)
    var m = /-([0-9]+.[0-9]+.[0-9]+(~[0-9]+)?)[.-]/.exec(name);
    return m ? m[1] : '';
  }

  function findRevision(name) {
    // reversion identifier like a1, v2
    var m = /-([a-z][0-9]+(.[0-9]+)?)[.-]/.exec(name);
    return m ? m[1] : 'alle';
  }

  function findRegion(name) {
    var m = /-(cn|de|en|eu|il|jp|us)[.-]/.exec(name);
    return m ? m[1] : '';
  }

  function findSize(name) {
    var m = /-(4M|8M|16M|32M|64M)[.-]/.exec(name);
    return m ? m[1] : '';
  }

  function addArray(obj, key, value) {
    if (key in obj) {
      obj[key].push(value);
    } else {
      obj[key] = [value];
    }
  }

  function parseFilePath(match, basePath, filename, branch) {
    var location = basePath + filename;

    var devices = vendormodels_reverse[match];
    if (!(devices instanceof Array) || devices.length != 1) {
      console.log("Error: vendormodels_reverse did not contain", match);
      return;
    }
    var device = devices[0];

    if (device.model == '--ignore--' || device.revision == '--ignore--') {
      return;
    }

    var strippedFilename = filename;
    strippedFilename = strippedFilename.replace(config.community_prefix, '-');

    var version = findVersion(strippedFilename);
    strippedFilename = strippedFilename.replace(version, '');

    strippedFilename = strippedFilename.replace(match, '');

    var revision = device.revision || findRevision(strippedFilename);
    strippedFilename = strippedFilename.replace(revision, '');

    var region = findRegion(strippedFilename);
    strippedFilename = strippedFilename.replace(region, '');

    if (region.length) {
      revision += '-' + region;
    }

    var size = findSize(strippedFilename);
    strippedFilename = strippedFilename.replace(size, '');

    var type = findType(strippedFilename);
    strippedFilename = strippedFilename.replace(type, '');

    strippedFilename = strippedFilename.replace(/.(bin|img.gz|img|tar|vdi|vmdk)/, '');
    strippedFilename = strippedFilename.replace(/-/g, '');

    if (strippedFilename !== '') {
      console.log("Match for file", filename, "was not exhaustive.");
      return;
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
      'location': location,
      'size': size
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

  // format string for searching
  function searchable(q) {
    return q.toLowerCase().replace(/[-/ ]/g, '');
  }

  // create a list with all models optimized for searching
  function createSearchableModellist() {
    var modelList = [];
    var vendors = Object.keys(images);
    for(var i in vendors) {
      var models = Object.keys(images[vendors[i]]);
      for (var j in models) {
        modelList.push([searchable(vendors[i]+models[j]), vendors[i], models[j]]);
      }
    }
    return modelList;
  }

  function createPicturePreview(vendor, model, searchstring) {
    if (!(vendor in images)) return '';
    if (!(model in images[vendor])) return '';

    // determine revision index (use image for latest revision)
    var latestRevisionIndex = 0;
    var highesRevision = 1;
    for (var r in images[vendor][model]) {
      var rev = images[vendor][model][r].revision.substr(1);
      if (parseInt(rev) > highesRevision){// && rev.toString() == parseInt(rev).toString()) {
        latestRevisionIndex = r;
        highesRevision = parseInt(rev);
      }
    }

    var location = images[vendor][model][latestRevisionIndex].location;
    var startIndex = location.lastIndexOf(vendor.toLowerCase().replace(/ /g, '-'));
    var src = location.substr(startIndex);
    src = src.replace(/(.bin|.img)$/, '.jpg');
    src = src.replace('-sysupgrade', '');
    src = src.replace('alfa-network', 'alfa');

    var image = document.createElement('img');
    image.src = 'pictures/'+src;
    image.alt = name;
    image.addEventListener('error', firmwarewizard.setDefaultImg);

    var caption = document.createElement('span');
    caption.innerText = vendor+' '+model;

    var wrapper = document.createElement('div');
    wrapper.className = 'preview';
    wrapper.style.display = 'none';
    wrapper.setAttribute('data-searchstring', searchstring);
    wrapper.setAttribute('data-vendor', vendor);
    wrapper.setAttribute('data-model', model);
    wrapper.addEventListener('click', previewClickEventHandler);
    wrapper.appendChild(image);
    wrapper.appendChild(caption);
    return wrapper;
  }

  function previewClickEventHandler(e) {
    var vendor = e.currentTarget.getAttribute('data-vendor');
    var model = e.currentTarget.getAttribute('data-model');
    app.setVendor(vendor);
    app.setModel(model);
    scrollDown();
  }

  function setDefaultImg(e) {
    fallbackImg = 'pictures/no_picture_available.jpg';
    if (e.target.src.search(fallbackImg) == -1) {
      e.target.src = fallbackImg;
    }
  }
  app.setDefaultImg = setDefaultImg;

  // search for models (and vendors)
  function searchModel(query) {
    function filterModelList(modelList, query) {
      var filteredModelList = [];
      query = searchable(query);
      for (var m in modelList) {
        if (modelList[m][0].search(query) != -1) {
          filteredModelList.push(modelList[m]);
        }
      }
      return filteredModelList;
    }

    var modelList = createSearchableModellist();

    // search for vendors and models
    var queryparts = query.split(' ');
    for(var q in queryparts) {
      modelList = filterModelList(modelList, queryparts[q]);
    }

    updatePreviewList(modelList);
  }
  app.searchModel = searchModel;

  function updatePreviewList(modelList) {
    var previews = document.querySelectorAll('.imagePreview .preview');
    for(var p = 0; p < previews.length; p++) {
      previews[p].style.display = 'none';
    }

    for (var f in modelList) {
      var searchstring = modelList[f][0];
      var vendor = modelList[f][1];
      var model = modelList[f][2];

      for(p = 0; p < previews.length; p++) {
        if (previews[p].getAttribute('data-searchstring') == searchstring) {
          previews[p].style.display = 'inline-block';
        }
      }
    }
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

      if (wizard.vendor != -1) {
        $('.modelSearch').value = wizard.vendor;
        searchModel(wizard.vendor);
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

      if (wizard.model != -1) {
        $('.modelSearch').value = wizard.vendor+' '+wizard.model;

        updatePreviewList([[
          searchable(wizard.vendor+wizard.model), wizard.vendor, wizard.model]]);
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

      if (wizard.vendor == -1 || wizard.model == -1 || isEmptyObject(images)) {
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
      var typeNames = {
        'factory': 'Erstinstallation',
        'sysupgrade': 'Upgrade',
        'rootfs': "Root-Image",
        'kernel': "Kernel-Image"
      };

      for (var i in types) {
        var type = types[i];
        if (type === '') continue;

        var displayType = typeNames[type] || type;
        content += '<input type="radio" id="radiogroup-typeselect-' +
          type + '" ' + ((type == wizard.imageType) ? 'checked ' : '') +
          'name="firmwareType" onclick="firmwarewizard.setImageType(\'' + type + '\'); scrollDown();">' +
          '<label for="radiogroup-typeselect-' + type + '">' + displayType + '</label>';
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
          $('#branchselect').innerHTML += '<button class="btn dl-expermental" onclick="toggleClass(\'#branch-pane\', \'show-experimental-warning\'); scrollDown();">'+rev.branch+' (' +rev.version+')</button>';
          $('#branch-experimental-dl').innerHTML = '<a href="'+rev.location+'" class="btn">Download für Experimentierfreudige</a>';
        } else {
          $('#branchselect').innerHTML += '<a href="'+rev.location+'" class="btn">'+rev.branch+' (' +rev.version+')</a>';
        }
      }
    }
    showBranches();

    function updateHardwareSelection() {
      if (wizard.vendor == -1) {
        hide('#modelselect');
        hide('.revisionselectWrapper');
      } else {
        show_inline('#modelselect');
        if (wizard.model == -1) {
          hide('.revisionselectWrapper');
        } else {
          show_inline('.revisionselectWrapper');
        }
      }
    }
    updateHardwareSelection();

    // add pictures for router models
    if ($('.imagePreview').innerHTML === '') {
      var previews = $('.imagePreview');
      var modelList = createSearchableModellist();
      for (var m in modelList) {
        var searchstring = modelList[m][0];
        var vendor = modelList[m][1];
        var model = modelList[m][2];
        previews.appendChild(createPicturePreview(vendor, model, searchstring));
      }
    }

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

    function updateCurrentVersions() {
      var branches = ObjectValues(config.directories)
        .filter(function(value, index, self) { return self.indexOf(value) === index; });

      $('#currentVersions').innerHTML = branches.reduce(function(ret, branch, i) {
        ret += ((i === 0) ? '' : ' // ') + branch;
        ret += (branch in app.currentVersions) ?  (': '  + app.currentVersions[branch]) : '';
        return ret;
      }, '');
    }
    updateCurrentVersions();

    function updateFirmwareTable() {
      $('#firmwareTableBody').innerHTML = '';

      var initializeRevHTML = function(rev) {
        if (upgradeRevBranchDict[rev.branch] === undefined) {
          upgradeRevBranchDict[rev.branch] = document.createElement('span');
        }
        if (factoryRevBranchDict[rev.branch] === undefined) {
          factoryRevBranchDict[rev.branch] = document.createElement('span');
        }
      };

      var addToRevHTML = function(rev) {
        var a = document.createElement('a');
        a.href = rev.location;
        a.title = rev.version;
        a.innerText = rev.revision;

        var textNodeStart = document.createTextNode('[');
        var textNodeEnd = document.createTextNode('] ');

        if (rev.type == 'sysupgrade') {
          upgradeRevBranchDict[rev.branch].appendChild(textNodeStart);
          upgradeRevBranchDict[rev.branch].appendChild(a);
          upgradeRevBranchDict[rev.branch].appendChild(textNodeEnd);
          show = true;
        } else if (rev.type == 'factory') {
          factoryRevBranchDict[rev.branch].appendChild(textNodeStart);
          factoryRevBranchDict[rev.branch].appendChild(a);
          factoryRevBranchDict[rev.branch].appendChild(textNodeEnd);
          show = true;
        }
      };

      function createRevTd(revBranchDict) {
        var td = document.createElement('td');
        for(var branch in revBranchDict) {
          var textNode;
          if (revBranchDict[branch].children.length === 0) {
            textNode = document.createTextNode(branch + ': -');
            td.appendChild(textNode);
          } else {
            textNode = document.createTextNode(branch + ': ');
            td.appendChild(textNode);
            td.appendChild(revBranchDict[branch]);
          }
          var br = document.createElement("br");
          td.appendChild(br);
        }
        return td;
      }

      var vendors = Object.keys(images).sort();
      for (var v in vendors) {
        var vendor = vendors[v];
        var models = Object.keys(images[vendor]).sort();
        for (var m in models) {
          var model = models[m];
          var revisions = sortByRevision(images[vendor][model]);
          var upgradeRevBranchDict = {};
          var factoryRevBranchDict = {};
          var show = false;

          revisions.forEach(initializeRevHTML);
          revisions.forEach(addToRevHTML);

          if (!show) {
            continue;
          }

          var tr = document.createElement('tr');

          var tdVendor = document.createElement('td');
          tdVendor.innerText = vendor;
          tr.appendChild(tdVendor);

          var tdModel = document.createElement('td');
          tdModel.innerText = model;
          tr.appendChild(tdModel);

          tr.appendChild(createRevTd(factoryRevBranchDict));
          tr.appendChild(createRevTd(upgradeRevBranchDict));

          $('#firmwareTableBody').appendChild(tr);
        }
      }
    }
    updateFirmwareTable();
  }

  function loadSite(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        callback(xmlhttp.responseText, url);
      }
    };
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
  }

  // parse the contents of the given directories
  function loadDirectories() {
    // sort by length to get the longest match
    var matches = Object.keys(vendormodels_reverse).sort(function(a, b) {
      if (a.length < b.length) return 1;
      if (a.length > b.length) return -1;
      return 0;
    });

    var parseSite = function(data, indexPath) {
      var basePath = indexPath.substring(0, indexPath.lastIndexOf('/') + 1);
      var branch = config.directories[indexPath];
      reLink.lastIndex = 0;

      var m;
      do {
        m = reLink.exec(data);
        if (m) {
          var href = m[1];
          if (ignoreFileName(href)) {
            continue;
          }
          var match = reMatch.exec(href);
          if (match) {
            parseFilePath(match[1], basePath, href, branch);
          } else if (config.listMissingImages) {
            console.log("No rule for firmware image:", href);
          }
        }
      } while (m);

      sitesLoadedSuccessfully++;
      if (sitesLoadedSuccessfully == Object.keys(config.directories).length) {
        updateHTML(wizard);
      }
    };

    // match all links
    var reLink = new RegExp('href="([^"]*)"', 'g');

    // match image files
    var reMatch = new RegExp('('+matches.join('|')+')[.-]');

    // check if image regexes contain regular expressions themself
    var reCheckRegex = new RegExp(/[^\\]+[+?*]/);

    if (reCheckRegex.exec(matches.join('|')) !== null) {
      console.log("Warning! Some regular expressions for firmware images, contain unescaped characters.");
    }

    var sitesLoadedSuccessfully = 0;
    for (var indexPath in config.directories) {
      // retrieve the contents of the directory
      loadSite(indexPath, parseSite);
    }
  }

  var vendormodels_reverse = buildVendorModelsReverse();
  loadDirectories();

  // set link to firmware source directory
  for(var path in config.directories) {
    $('#firmware-source-dir').href = path.replace(/\/[^\/]*$/, '');
    break;
  }

  return app;
}();
