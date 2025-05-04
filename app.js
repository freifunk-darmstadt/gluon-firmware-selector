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
var firmwarewizard = function() {
  var app = {};

  // helper functions
  function $(s) {
    return document.querySelector(s);
  }

  function toggleClass(e, cssClass) {
    setClass(e, cssClass, !hasClass(e, cssClass));
  }

  function hasClass(e, cssClass) {
    var searchstring = (' ' + e.className + ' ').replace(/[\n\t]/g, " ");
    return (searchstring.indexOf(' ' + cssClass+ ' ') !== -1);
  }

  function setClass(e, cssClass, active) {
    if (active && !hasClass(e, cssClass)) {
      e.className = (e.className+' '+cssClass).trim();
    } else if (!active && hasClass(e, cssClass)) {
      e.className = e.className.replace(cssClass, '');
    }
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

  function sortCaseInsensitive(a, b) {
	return a.localeCompare(b, 'en', {'sensitivity': 'base'});
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
    try {
      window.scrollBy({
        top: 512,
        left: 0,
        behavior: 'smooth'
      });
    } catch (e) {
      var start = document.body.scrollTop;
      var lastTop = start - 1;
      var interval = window.setInterval(function() {
        if (document.body.scrollTop > start + 512 || lastTop - document.body.scrollTop === 0) {
          window.clearInterval(interval);
          console.log('stop');
        }
        lastTop = document.body.scrollTop;
        document.body.scrollTop += 4;
      }, 1);
    }
  }

  // constants
  var IGNORED_ELEMENTS = [
    './', '../', '.manifest',
    '-tftp', '-fat', '-loader', '-NA', '-x2-', '-hsv2', '-p1020'
  ];
  var PANE = {'MODEL': 0, 'IMAGETYPE': 1, 'BRANCH': 2};

  // the invisible separator is used to delimit searchstring parts, e.g.
  // "NanoStation[SEPARATOR]" vs. "NanoStation Loco[SEPARATOR]"
  var INVISIBLE_SEPARATOR = '\u2063';
  var NON_BREAKING_SPACE = '\u00A0';
  //var INVISIBLE_SEPARATOR = '#'; // debug
  //var NON_BREAKING_SPACE = '?'; // debug

  var MODEL_SEARCHSTRING = 0;
  var MODEL_STRIPPED_SEARCHSTRING = 1;
  var MODEL_VENDOR = 2;
  var MODEL_MODEL = 3;
  var MODEL_MATCHED_REVISION = 4;

  var wizard = parseWizardObject();
  app.currentVersions = {};
  var availableImages = {};
  var images = availableImages;
  var vendormodels_reverse;

  var typeNames = {
    'factory': 'Erstinstallation',
    'sysupgrade': 'Upgrade',
    'rootfs': "Root-Image",
    'kernel': "Kernel-Image",
    'eva-filesystem': 'Bootloader-Root-Image',
    'eva-kernel': 'Bootloader-Kernel-Image',
    'bootloader': 'Bootloader-Image',
    'recovery': 'Recovery-Image'
  };

  var branches = ObjectValues(config.directories).filter(function(e, index, self) {
    return index === self.indexOf(e);
  });

  var reFileExtension = new RegExp(/\.(bin|chk|img\.gz|img|tar|ubi|itb)$/);
  var reRemoveDashes = new RegExp(/-/g);
  var reSearchable = new RegExp('[-/ '+NON_BREAKING_SPACE+']', 'g');
  var reRemoveSpaces = new RegExp(/ /g);
  var reStripDashes = new RegExp(/^\-+|\-+$/g);

  if (config.version_regex === undefined) {
    console.log("config.version_regex missing in config.js");
    return;
  }
  var reVersionRegex = new RegExp(config.version_regex);

  var rePrettyPrintVersionRegex;
  if(config.prettyPrintVersionRegex !== undefined) {
    rePrettyPrintVersionRegex = new RegExp(config.prettyPrintVersionRegex);
  }

  var PREVIEW_PICTURES_DIR = 'pictures/';
  if(config.preview_pictures !== undefined) {
    PREVIEW_PICTURES_DIR = config.preview_pictures;
  }

  var PREVIEW_PICTURES_EXT = '.jpg';
  if(config.preview_pictures_ext !== undefined) {
    PREVIEW_PICTURES_EXT = config.preview_pictures_ext;
  }

  var enabled_device_categories = ['recommended'];
  if ("enabled_device_categories" in config) {
    enabled_device_categories = config.enabled_device_categories;
  }
  if ("recommended_toggle" in config && config.recommended_toggle) {
    enabled_device_categories = ['recommended'];
    show_inline('.notRecommendedLink');

    if (config.recommended_info_link) {
      $('#notrecommendedinfo').innerHTML = '<p><a href="' + config.recommended_info_link + '" target="_new">Mehr Informationen</a>';
    }
  }

  function buildVendorModelsReverse() {
    var vendormodels_reverse = {};

    for (var device_category in config.vendormodels) {
      for (var vendor in config.vendormodels[device_category]) {
        var models = config.vendormodels[device_category][vendor];
        for (var model in models) {
          var match = models[model];
          if (typeof match == 'string') {
            addArray(vendormodels_reverse, match, {'vendor': vendor, 'model': model, 'revision': '', category: device_category});
          } else for (var m in match) {
            addArray(vendormodels_reverse, m, {'vendor': vendor, 'model': model, 'revision': match[m], category: device_category});
          }
        }
      }
    }

    return vendormodels_reverse;
  }

  function createHistoryState(wizard) {
    if (!window.history || !history.pushState) return;

    var parameters = '';
    for (var key in wizard) {
      if (wizard[key] != -1 && wizard[key] !== false) {
        parameters += '&' + key + '=' + encodeURIComponent(wizard[key]);
      }
    }

    // replace first occurence of "&" by "?"
    parameters = parameters.replace('&', '?');
    history.pushState(wizard, '', parameters || '?');
  }

  function parseWizardObject(wizard) {
    if (wizard === undefined || wizard === null) wizard = {};
    wizard.q                 = wizard.q || '';
    wizard.showFirmwareTable = (wizard.showFirmwareTable == 'true');
    return wizard;
  }

  function setFilteredImages() {
    images = {};
    for (var vendor in availableImages) {
      images[vendor] = {};
      for (var model in availableImages[vendor]) {
        for (var device in availableImages[vendor][model]) {
          if (enabled_device_categories.indexOf(availableImages[vendor][model][device].category) > -1) {
            addArray(images[vendor], model, availableImages[vendor][model][device]);
          }
        }
      }
    }
  }

  window.onpopstate = function(event) {
    if (event.state === null) return;
    wizard = parseWizardObject(event.state);
    $('.modelSearch').value = wizard.q;
    updateHTML(wizard);
  };

  window.onload = function() {
    if (config.title !== undefined) {
      document.title = config.title;
    }

    $('#notrecommendedselect').checked = false;

    function parseURLasJSON() {
      var search = location.search.substring(1);
      return search ? JSON.parse(
        '{"' + search.replace(/&/g, '","').replace(/=/g,'":"').replace(/\+/g,'%20') + '"}',
        function(key, value) {
          return (key=== '') ? value:decodeURIComponent(value);
        }):{};
    }
    var parsedURL = parseURLasJSON();
    wizard = parseWizardObject(parsedURL);
    $('.modelSearch').value = wizard.q;

    $('.modelSearch').addEventListener('keyup', function(e) {
      firmwarewizard.updateSearchQuery($('.modelSearch').value);
    });

    $('#vendorselect').addEventListener('change', function(e) {
      firmwarewizard.setSearchQuery($('#vendorselect').value);
      scrollDown();
    });

    $('#modelselect').addEventListener('change', function(e) {
      firmwarewizard.setSearchQuery($('#modelselect').value);
      scrollDown();
    });

    $('#revisionselect').addEventListener('change', function(e) {
      firmwarewizard.setSearchQuery($('#revisionselect').value);
      scrollDown();
    });

    $('#wizard .notRecommendedLink').addEventListener('click', function(e) {
      toggleClass($('#model-pane'), 'show-notrecommended-warning');
    });

    $('#wizard .firmwareTableLink').addEventListener('click', function(e) {
      firmwarewizard.showFirmwareTable();
    });

    $('#firmwareTable .firmwareTableLink').addEventListener('click', function(e) {
      firmwarewizard.hideFirmwareTable();
    });

    $('#notrecommendedselect').addEventListener('change', function(e) {
      if (this.checked) {
        enabled_device_categories = config.enabled_device_categories;
      } else if ("enabled_device_categories" in config) {
        enabled_device_categories = ['recommended'];
      }
      setFilteredImages();
      updateHTML(wizard);
      updateFirmwareTable();
    });

    vendormodels_reverse = buildVendorModelsReverse();

    loadDirectories(function() {
      // initialize pictures for router models
      var previews = $('.imagePreview');
      var fullModelList = createSearchableModellist();
      for (var m in fullModelList) {
        var searchstring = fullModelList[m][MODEL_SEARCHSTRING];
        var vendor = fullModelList[m][MODEL_VENDOR];
        var model = fullModelList[m][MODEL_MODEL];
        previews.appendChild(createPicturePreview(vendor, model, searchstring));
      }
      setFilteredImages();
      updateHTML(wizard);
      show_block('.manualSelection');
      updateFirmwareTable();
    });

    // set link to firmware source directory
    for(var path in config.directories) {
      $('#firmware-source-dir').href = path.replace(/\/[^\/]*$/, '');
      break;
    }
  };

  function updateSearchQuery(query) {
    wizard.q = query;
    createHistoryState(wizard);
    updateHTML(wizard);
  }
  app.updateSearchQuery = updateSearchQuery;

  function setSearchQuery(query) {
    $('.modelSearch').value = query;
    updateSearchQuery(query);
  }
  app.setSearchQuery = setSearchQuery;

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
    var m = /-(sysupgrade|factory|rootfs|kernel|eva-filesystem|eva-kernel|bootloader|recovery)[-.]/.exec(name);
    return m ? m[1] : 'factory';
  }

  function findVersion(name) {
    var m = reVersionRegex.exec(name);
    return m ? m[1] : '';
  }

  // regex that is applied to the version to print a prettier version
  function prettyPrintVersion(version) {
    if (rePrettyPrintVersionRegex !== undefined) {
      var v = rePrettyPrintVersionRegex.exec(version);
      return v ? v[1] : version;
    }
    return version;
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
    var location = basePath + encodeURIComponent(filename);

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

    strippedFilename = strippedFilename.replace(reFileExtension, '');
    strippedFilename = strippedFilename.replace(reRemoveDashes, '');

    if (strippedFilename !== '') {
      console.log("Match for file", filename, "was not exhaustive. Missing filename parts:", strippedFilename);
      return;
    }

    // derive preview file name
    var preview = filename;
    preview = preview.replace(config.community_prefix, '');
    preview = preview.replace(version, '');
    preview = preview.replace(revision, '');
    preview = preview.replace(region, '');
    preview = preview.replace(size, '');
    preview = preview.replace(type, '');
    preview = preview.replace(reFileExtension, '');
    preview = preview.replace(reStripDashes, '');

    // vendor and model specific fine tuning
    preview = preview.replace('alfa-network', 'alfa');
    preview = preview.replace('buffalo-wzr-hp-ag300h', 'buffalo-wzr-hp-ag300h-wzr-600dhp');
    preview = preview.replace('buffalo-wzr-600dhp', 'buffalo-wzr-hp-ag300h-wzr-600dhp');
    preview = preview.replace('buffalo-wzr-hp-g300nh2', 'buffalo-wzr-hp-g300nh');
    preview = preview.replace('d-link-dir-505-rev', 'd-link-dir-505-rev-a1');
    preview = preview.replace('d-link-dir-825-rev', 'd-link-dir-825-rev-b1');
    preview = preview.replace('gl-inet-6408a', 'gl-inet-6408a-v1');
    preview = preview.replace('gl-inet-6416a', 'gl-inet-6416a-v1');
    preview = preview.replace('netgear-wndrmac', 'netgear-wndrmacv2');
    preview = preview.replace('openmesh-mr600', 'openmesh-mr600-v1');
    preview = preview.replace('openmesh-mr900', 'openmesh-mr900-v1');
    if (preview.indexOf('tp-link') != -1) preview += '-' + revision;
    preview = preview.replace('tp-link-archer-c5-v1', 'tp-link-archer-c7-v2'); // Archer C5 v1 and Archer C7 v2 are identical
    preview = preview.replace('tp-link-tl-wa801n-nd-v3', 'tp-link-tl-wa801n-nd-v2'); // no preview picture for v3 yet
    preview = preview.replace('tp-link-tl-wr940n-v3', 'tp-link-tl-wr940n-v2'); // no preview picture for v3 yet
    preview = preview.replace('ubiquiti-unifi-ap', 'ubiquiti-unifi');
    preview = preview.replace('ubiquiti-unifi-lr', 'ubiquiti-unifi');
    preview = preview.replace('ubiquiti-unifi-pro', 'ubiquiti-unifi-ap-pro');
    preview = preview.replace('x86-virtualbox', 'x86-virtualbox.vdi');
    preview = preview.replace('x86-64-virtualbox', 'x86-virtualbox.vdi');
    preview = preview.replace('x86-vmware', 'x86-vmware.vmdk');
    preview = preview.replace('x86-64-vmware', 'x86-vmware.vmdk');
    preview = preview.replace('x86-generic', 'x86-generic.img');
    preview = preview.replace('x86-64', 'x86-generic.img');
    preview = preview.replace('x86-kvm', 'x86-kvm.img');
    preview = preview.replace('x86-generic.img.vdi', 'x86-virtualbox.vdi');
    preview = preview.replace('x86-generic.img.vmdk', 'x86-vmware.vmdk');
    preview = preview.replace('x86-legacy', 'x86-legacy.img');

    // collect branch versions
    app.currentVersions[branch] = version;

    if (!(device.vendor in availableImages)) {
      availableImages[device.vendor] = {};
    }

    addArray(availableImages[device.vendor], device.model, {
      'revision': revision,
      'branch': branch,
      'type': type,
      'version': version,
      'location': location,
      'size': size,
      'preview': preview,
      'category': device.category
    });
  }

  function createOption(value, title, selectedOption) {
    var o = document.createElement('option');
    o.value = value;
    o.innerText = title;
    o.selected = (value === selectedOption);
    return o;
  }

  function getRevisions(currentVendor, currentModel) {
    var models = images[currentVendor];
    if (models === undefined) {
      return [];
    }

    var revisions = models[currentModel];
    if (revisions === undefined) {
      return [];
    }

    return sortByRevision(revisions)
      .map(function(e) { return e.revision; })
      .filter(function(value, index, self) { return self.indexOf(value) === index; });
  }

  function getImageTypes(modelList) {
    if (modelList.length == 1) {
      var vendor = modelList[0][MODEL_VENDOR];
      var model = modelList[0][MODEL_MODEL];
      var revision = modelList[0][MODEL_MATCHED_REVISION];
      return images[vendor][model]
        .filter(function(value, index, self) { return value['revision'] == revision; })
        .map(function(e) { return e.type; })
        .filter(function(value, index, self) { return self.indexOf(value) === index; })
        .sort();
    } else {
      return [];
    }
  }

  // format string for searching
  function searchable(q) {
    return q.toLowerCase().replace(reSearchable, '');
  }

  // make string atomic (atomic strings won't get split when searching for models
  // and have a well-defined ending)
  function atomic(q) {
    return q.replace(/ /g, NON_BREAKING_SPACE) + INVISIBLE_SEPARATOR;
  }

  // create a list with all models optimized for searching
  function createSearchableModellist() {
    var modelList = [];
    var vendors = Object.keys(images);
    for(var i in vendors) {
      var models = Object.keys(images[vendors[i]]);
      for (var j in models) {
        var revisions = getRevisions(vendors[i], models[j]);
        var searchingstring = searchable(
          vendors[i]+INVISIBLE_SEPARATOR+models[j]+INVISIBLE_SEPARATOR+
          revisions.map(atomic).join(''));

        // The 2nd searchingstring entry is used to strip already matched query
        // parts. This is needed when vendor and model are the same (e.g.
        // "Vocore Vocore") and there are more models from the same vendor.
        // The last entry is used to store the revision matched by the searchstring.
        modelList.push([searchingstring, searchingstring, vendors[i], models[j], '']);
      }
    }

    // Sort the reulting list alphabetically
    modelList = modelList.sort(function(a, b) {
      return a[0] > b[1] ? 1 : -1;
    });

    return modelList;
  }

  // search for models (and vendors)
  function searchModel(query) {
    var foundImageType = '';
    var modelList = createSearchableModellist(); // TODO: maybe generate once + deepcopy

    // search for vendors and models
    var queryparts = query.split(' ');
    for(var i in queryparts) {
      var q = searchable(queryparts[i]);
      var atomicQ = q;
      if (q.length === 0 || q[q.length-1] !== INVISIBLE_SEPARATOR) {
        atomicQ += INVISIBLE_SEPARATOR;
      }
      var filteredModelList = [];
      for (var m in modelList) {
        if (modelList[m][MODEL_STRIPPED_SEARCHSTRING].indexOf(q) != -1) {
          modelList[m][MODEL_STRIPPED_SEARCHSTRING] = modelList[m][MODEL_STRIPPED_SEARCHSTRING].replace(q, '');
          // add revision to modelList entry (if unique)
          var revisions = getRevisions(modelList[m][MODEL_VENDOR], modelList[m][MODEL_MODEL]);
          if (revisions.length == 1 && revisions[0] == 'alle') {
            modelList[m][MODEL_MATCHED_REVISION] = revisions[0];
          } else {
            var r = revisions.map(atomic).map(searchable).indexOf(atomicQ);
            if (r != -1) {
              modelList[m][MODEL_MATCHED_REVISION] = revisions[r]; // add revision to modelList entry
            }
          }
          filteredModelList.push(modelList[m]);
        } else {
          var typeKeys = Object.keys(typeNames);
          var typeValues = ObjectValues(typeNames);
          for (var k in typeKeys) {
            if (searchable(typeKeys[k]).substr(0, q.length) == q ||
                searchable(typeValues[k]).substr(0, q.length) == q) {
              foundImageType = Object.keys(typeNames)[k];
              filteredModelList.push(modelList[m]);
            }
          }
        }
      }
      modelList = filteredModelList;
    }

    var searchResult = {};
    searchResult.vendor = getVendorFromModelList(modelList);
    searchResult.model = '';
    searchResult.revision = '';
    searchResult.imageType = foundImageType;
    searchResult.imageTypes = [];
    searchResult.modelList = modelList;
    if (modelList.length == 1) {
      searchResult.model = modelList[0][MODEL_MODEL];
      searchResult.revision = modelList[0][MODEL_MATCHED_REVISION];
      searchResult.imageTypes = getImageTypes(modelList);
    }
    return searchResult;
  }

  // check if vendor is unique and return the vendor name
  function getVendorFromModelList(modelList) {
    var vendor = '';
    for (var i in modelList) {
      if (vendor === '') vendor = modelList[i][MODEL_VENDOR];
      if (vendor != modelList[i][MODEL_VENDOR]) return '';
    }
    return vendor;
  }

  function createPicturePreview(vendor, model, searchstring) {
    if (!(vendor in images)) return '';
    if (!(model in images[vendor])) return '';

    // determine revision index (use image for latest revision)
    var latestRevisionIndex = 0;
    var highestRevision = 1;
    for (var r in images[vendor][model]) {
      var rev = images[vendor][model][r].revision.substr(1);
      if (parseInt(rev) > highestRevision){
        latestRevisionIndex = r;
        highestRevision = parseInt(rev);
      }
    }

    var image = document.createElement('img');

    image.src = PREVIEW_PICTURES_DIR+images[vendor][model][latestRevisionIndex].preview+PREVIEW_PICTURES_EXT;
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
    app.setSearchQuery(atomic(vendor)+' '+atomic(model));
    setClass(e.currentTarget, 'selected', true);
    scrollDown();
  }

  function setDefaultImg(e) {
    fallbackImg = 'pictures/no_picture_available.jpg';
    if (e.target.src.indexOf(fallbackImg) == -1) {
      e.target.src = fallbackImg;
    }
  }
  app.setDefaultImg = setDefaultImg;

  function updatePreviewList(modelList) {
    var previews = document.querySelectorAll('.imagePreview .preview');
    for(var p = 0; p < previews.length; p++) {
      previews[p].style.display = 'none';
      setClass(previews[p], 'selected', false);
    }

    for (var f in modelList) {
      var searchstring = modelList[f][MODEL_SEARCHSTRING];
      var vendor = modelList[f][MODEL_VENDOR];
      var model = modelList[f][MODEL_MODEL];

      for(p = 0; p < previews.length; p++) {
        if (previews[p].getAttribute('data-model') == model) {
          previews[p].style.display = 'inline-block';
          if (modelList.length == 1) {
            setClass(previews[p], 'selected', true);
          }
        }
      }
    }
  }

  function hasVendorDevicesForEnabledDeviceCategories(vendor) {
    if (images[vendor]) {
      for (let [key, value] of Object.entries(images[vendor])) {
        if (enabled_device_categories.includes(value[0].category)) {
          return true;
        }
      }
    }
    return false;
  }

  function getVendors() {
    var vendorlist = [];
    for (var device_category_idx in enabled_device_categories) {
      var device_category = enabled_device_categories[device_category_idx];
      var category_vendors = Object.keys(config.vendormodels[device_category]);
      category_vendors.forEach(function (val, idx) {
        if (!vendorlist.includes(val) && hasVendorDevicesForEnabledDeviceCategories(val)) {
          vendorlist.push(val);
        }
      });
    }
    return vendorlist;
  }

  // update all elements of the page according to the wizard object.
  function updateHTML(wizard) {
    // parse searchstring to retrieve current vendor and model
    var s = searchModel(wizard.q);

    if (wizard.showFirmwareTable) {
      show_block('#firmwareTable');
      hide('#wizard');
    } else {
      show_block('#wizard');
      hide('#firmwareTable');
    }

    // show vendor dropdown menu.
    function showVendors(currentVendor) {
      var select = $('#vendorselect');

      select.innerHTML = '';
      select.appendChild(
        createOption('', '-- Bitte Hersteller wählen --')
      );

      var vendors = getVendors().sort(sortCaseInsensitive);
      for (var i in vendors) {
        select.appendChild(
          createOption(atomic(vendors[i]), vendors[i], atomic(currentVendor))
        );
      }
    }
    showVendors(s.vendor);

    // show model dropdown menu
    function showModels(currentVendor, currentModel) {
      var select = $('#modelselect');
      setClass(select, 'invalid', currentModel === '');

      select.innerHTML = '';
      select.appendChild(createOption(
        atomic(currentVendor),
        '-- Bitte Modell wählen --',
        atomic(currentVendor))
      );

      if (currentVendor === '' || isEmptyObject(images)) {
        return;
      }

      var prefix = atomic(currentVendor) + ' ';
      var models = Object.keys(images[currentVendor]).sort(sortCaseInsensitive);
      for (var i in models) {
        select.appendChild(createOption(
          prefix + atomic(models[i]),
          models[i],
          prefix + atomic(currentModel)));
      }
    }
    showModels(s.vendor, s.model);

    // show revision dropdown menu
    function showRevisions(currentVendor, currentModel, currentRevision) {
      var select = $('#revisionselect');
      setClass(select, 'invalid', currentRevision === '');

      select.innerHTML = '';
      select.appendChild(createOption(
        atomic(currentVendor) + ' ' + atomic(currentModel),
        '-- Bitte Hardwarerevision wählen --',
        atomic(currentVendor) + ' ' + atomic(currentModel))
      );

      if (currentVendor === '' || currentModel === '' || isEmptyObject(images)) {
        return;
      }

      var prefix = atomic(currentVendor) + ' ' +
                   atomic(currentModel) + ' ';
      var revisions = getRevisions(currentVendor, currentModel);
      for (var i in revisions) {
        select.appendChild(createOption(
          prefix + atomic(revisions[i]),
          revisions[i],
          prefix + atomic(currentRevision))
        );
      }
    }
    showRevisions(s.vendor, s.model, s.revision);

    updatePreviewList(s.modelList);

    // show image type selection
    function showImageTypes(currentVendor, currentModel, currentRevision, currentImageTypes, currentImageType) {
      if (currentModel === '' || isEmptyObject(images)) {
        return;
      }

      function imageTypeChangedEventHandler(e) {
        setSearchQuery(e.target.getAttribute('data-query'));
        scrollDown();
      }

      // find device info link
      function findDeviceInfo(vendor, model, revision, links) {
        if (links[vendor] !== undefined && links[vendor][model] !== undefined) {
          revisions = links[vendor][model];
        } else {
          return '';
        }

        if (typeof revisions == 'object' && revisions[revision] !== undefined) {
          return revisions[revision];
        } else if (typeof revisions == 'string') {
          return revisions;
        } else {
          return '';
        }
      }

      var url = '';
      var custom_url = '';
      var deviceinfo = $('#deviceinfo');
      deviceinfo.innerHTML = '';

      url = findDeviceInfo(currentVendor, currentModel, currentRevision, devices_info);

      if ("devices_info" in config){
        custom_url = findDeviceInfo(currentVendor, currentModel, currentRevision, config.devices_info);
      }

      if (custom_url !== '') {
        url = custom_url;
      }

      if (url !== '') {
        setClass($('#type-pane'), 'show-deviceinfo-warning', true);

        var a = document.createElement('a');
        a.href = url;
        a.className = 'btn';
        a.target = '_blank';
        a.innerText = 'Anleitung';

        deviceinfo.appendChild(a);
      } else {
        setClass($('#type-pane'), 'show-deviceinfo-warning', false);
      }

      var typeselect = $('#typeselect');
      typeselect.innerHTML = '';

      var prefix = atomic(currentVendor) + ' ' +
                   atomic(currentModel) + ' ' +
                   atomic(currentRevision) + ' ';

      for (var i in currentImageTypes) {
        var type = currentImageTypes[i];
        if (type === '') continue;
        var displayType = typeNames[type] || type;
        var query = prefix + displayType;

        var input = document.createElement('input');
        input.id = 'radiogroup-typeselect-' + type;
        input.type = 'radio';
        input.name = 'firmwareType';
        input.checked = (type == currentImageType);
        input.setAttribute('data-query', query);
        input.addEventListener('click', imageTypeChangedEventHandler);

        var label = document.createElement('label');
        label.for = 'radiogroup-typeselect-' + type;
        label.innerText = displayType;
        label.setAttribute('data-query', query);
        label.addEventListener('click', imageTypeChangedEventHandler);

        typeselect.appendChild(input);
        typeselect.appendChild(label);
      }
    }
    showImageTypes(s.vendor, s.model, s.revision, s.imageTypes, s.imageType);

    // show branch selection
    function showBranches(currentVendor, currentModel, currentRevision, currentImageType) {
      if (currentVendor === '' || currentModel === '' ||
          currentRevision === '' || currentImageType === '' ||
          isEmptyObject(images)) {
        return;
      }

      var revisions = images[currentVendor][currentModel].filter(function(e) {
        return e.revision == currentRevision && e.type == currentImageType;
      }).sort(function(a, b) {
        // non-experimental branches should appear first
        var a_experimental = config.experimental_branches.indexOf(a.branch) != -1;
        var b_experimental = config.experimental_branches.indexOf(b.branch) != -1;
        if (a_experimental && !b_experimental) return 1;
        if (!a_experimental && b_experimental) return -1;
        return branches.indexOf(a.branch) > branches.indexOf(b.branch);
      });

      $('#branchdescs').innerHTML = '';
      $('#branchselect').innerHTML = '';
      $('#branch-experimental-dl').innerHTML = '';

      var toggleExperimentalWarning = function() {
        toggleClass($('#branch-pane'), 'show-experimental-warning');
        scrollDown();
      };

      for (var i in revisions) {
        var rev = revisions[i];
        var a = document.createElement('a');
        a.href = rev.location;
        a.className = 'btn';
        a.innerText = rev.branch +
                      (rev.size!==''?' ['+rev.size+']':'') +
                      ' (' +prettyPrintVersion(rev.version)+')';

        if (rev.branch in config.branch_descriptions) {
          var li = document.createElement('li');
          var name = document.createElement('span');
          name.innerText = rev.branch;
          name.id = 'branchName';
          var desc = document.createElement('span');
          desc.id = 'branchDesc'
          desc.innerText = ' ' + config.branch_descriptions[rev.branch];

          li.appendChild(name);

          if (rev.branch == config.recommended_branch) {
            var recommended = document.createElement('sup');
            recommended.innerText = ' Empfehlung';
            name.appendChild(recommended);
          }

          br = document.createElement('br');
          li.appendChild(br);
          li.appendChild(desc);
          $('#branchdescs').appendChild(li);
        }

        if (config.experimental_branches.indexOf(rev.branch) != -1) {
          if($('#branchselect .dl-experimental') === null) {
            var button = document.createElement('button');
            button.className = 'btn dl-experimental';
            button.addEventListener('click', toggleExperimentalWarning);
            button.innerText = 'Experimentelle Firmware anzeigen';
            $('#branchselect').appendChild(button);
          }
          $('#branch-experimental-dl').appendChild(a);
        } else {
          $('#branchselect').appendChild(a);
        }
      }
    }
    showBranches(s.vendor, s.model, s.revision, s.imageType);

    // update hardware dropdown menu
    if (s.vendor === '') {
      hide('#modelselect');
      hide('#revisionselect');
    } else {
      show_inline('#modelselect');
      if (s.model === '') {
        hide('#revisionselect');
      } else {
        show_inline('#revisionselect');
      }
    }

    function updatePanes(currentVendor, currentModel, currentRevision, currentImageType) {
      var pane = PANE.MODEL;
      if (currentVendor !== '' && currentModel !== '' && currentRevision !== '') {
        pane = PANE.IMAGETYPE;
        if (currentImageType !== '') {
          pane = PANE.BRANCH;
        }
      }

      $('#model-pane').style.display = (pane >= PANE.MODEL) ? 'block' : 'none';
      $('#type-pane').style.display = (pane >= PANE.IMAGETYPE) ? 'block' : 'none';
      $('#branch-pane').style.display = (pane >= PANE.BRANCH) ? 'block' : 'none';
    }
    updatePanes(s.vendor, s.model, s.revision, s.imageType);

    function updateCurrentVersions() {
      $('#currentVersions').innerText = '';
      if (config.changelog !== undefined) {
        var a = document.createElement('a');
        a.href = config.changelog;
        a.innerText = 'CHANGELOG';
        $('#currentVersions').appendChild(a);
        var text = document.createTextNode(' // ');
        $('#currentVersions').appendChild(text);
      }

      var versionStr = branches.reduce(function(ret, branch, i) {
        ret += ((i === 0) ? '' : ' // ') + branch;
        ret += (branch in app.currentVersions) ?  (': '  + prettyPrintVersion(app.currentVersions[branch])) : '';
        return ret;
      }, '');
      $('#currentVersions').appendChild(document.createTextNode(versionStr));
    }
    updateCurrentVersions();
  }

  function updateFirmwareTable() {
    $('#firmwareTableBody').innerHTML = '';

    var initializeRevHTML = function(rev) {
      if (bootloaderRevBranchDict[rev.branch] === undefined) {
        bootloaderRevBranchDict[rev.branch] = document.createElement('span');
      }
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
      a.title = prettyPrintVersion(rev.version);
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
      } else if (rev.type == 'bootloader') {
        bootloaderRevBranchDict[rev.branch].appendChild(textNodeStart);
        bootloaderRevBranchDict[rev.branch].appendChild(a);
        bootloaderRevBranchDict[rev.branch].appendChild(textNodeEnd);
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

    var vendors = Object.keys(images).sort(sortCaseInsensitive);
    for (var v in vendors) {
      var vendor = vendors[v];
      var models = Object.keys(images[vendor]).sort(sortCaseInsensitive);
      for (var m in models) {
        var model = models[m];
        var revisions = sortByRevision(images[vendor][model]);
        var upgradeRevBranchDict = {};
        var factoryRevBranchDict = {};
        var bootloaderRevBranchDict = {};
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

        tr.appendChild(createRevTd(bootloaderRevBranchDict));
        tr.appendChild(createRevTd(factoryRevBranchDict));
        tr.appendChild(createRevTd(upgradeRevBranchDict));

        $('#firmwareTableBody').appendChild(tr);
      }
    }
  }

  function loadSite(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        callback(xmlhttp.responseText, url);
      } else if (xmlhttp.readyState == 4) {
        console.log("Could not load " + url);
        callback(null, url);
      }
    };
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
  }

  // parse the contents of the given directories
  function loadDirectories(callback) {
    var parseSite = function(data, indexPath) {
      var basePath = indexPath.substring(0, indexPath.lastIndexOf('/') + 1);
      var branch = config.directories[indexPath];
      reLink.lastIndex = 0;

      var hrefMatch;
      do {
        hrefMatch = reLink.exec(data);
        if (hrefMatch) {
          var href = decodeURIComponent(hrefMatch[1]);
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
      } while (hrefMatch);

      // check if we loaded all directories
      directoryLoadCount++;
      if (directoryLoadCount == Object.keys(config.directories).length) {
        callback();
      }
    };

    // match all links
    var reLink = new RegExp('href="([^"]*)"', 'g');

    // sort by length to get the longest match
    var matches = Object.keys(vendormodels_reverse).sort(function(a, b) {
      if (a.length < b.length) return 1;
      if (a.length > b.length) return -1;
      return 0;
    });

    // prepare the matches for use in regex (join by pipe and escape regex special characters)
    // according to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    var matchString = matches.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // match image files. The match either ends with
    // - a dash or dot (if a file extension will follow)
    // - the end of the expression (if the file extension is part of the regex)
    var reMatch = new RegExp('('+matchString+')([.-]|$)');

    var directoryLoadCount = 0;
    for (var indexPath in config.directories) {
      // retrieve the contents of the directory
      loadSite(indexPath, parseSite);
    }
  }

  return app;
}();
