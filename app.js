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

var firmwarewizard = function(){
  var app = {};

  var config = {
    imageBasePath: './images/',
    gluonPrefix: 'gluon-ffda-',
    typeNames: {
      "factory": "Erstinstallation",
      "sysupgrade": "Upgrade"
    }
  };

  var IGNORED_ELEMENTS = ['../', 'Name', 'Last modified', 'Size', 'Description',
                          'Parent Directory', 'SHA256SUMS', 'stable.manifest',
                          'beta.manifest', 'experimental.manifest'];

  var PANE = {'MODEL': 0, 'IMAGETYPE': 1, 'BRANCH': 2};

  var wizard = parseWizardObject();
  app.currentVersions = {};
  var available_images = {};

  function createHistoryState(wizard) {
    if (!window.history || !history.pushState) return;

    var parameters = "";
    for (var key in wizard) {
      parameters += "&"+key+"="+encodeURIComponent(wizard[key])
    }
    // replace first occurence of "&" by "?"
    parameters = parameters.replace('&','?');
    history.pushState(wizard, "", parameters);
  }

  function parseWizardObject(wizard) {
    if (wizard === undefined || wizard === null) wizard = {};
    wizard.vendor            = wizard.vendor || -1;
    wizard.model             = wizard.model || -1;
    wizard.revision          = wizard.revision || -1;
    wizard.imageType         = wizard.imageType || -1;
    wizard.showFirmwareTable = wizard.showFirmwareTable == "true";
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
      return search?JSON.parse(
        '{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
        function(key, value) {
          return key===""?value:decodeURIComponent(value)
        }):{};
    }
    var parsedURL = parseURLasJSON();
    wizard = parseWizardObject(parsedURL);
    updateHTML(wizard);
  }

  app.genericError = function() {
    alert("Da ist was schiefgelaufen. Frage doch bitte einmal im Chat nach.");
  };

  // ----- methods to set options -----
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
      // skip revision selection if there is only the option 'alle'
      var addedRevs = [];
      var revisions = getRevisions();
      if (revisions == -1) return;
      for (var i in revisions) {
        if ($.inArray(revisions[i].revision, addedRevs) == -1) {
          addedRevs.push(revisions[i].revision);
        }
      }
      if (addedRevs.length == 1 && addedRevs[0] == 'alle') {
        app.setRevision('alle', true);
      }
    }

    createHistoryState(wizard);
    updateHTML(wizard);
  };

  app.setRevision = function(revision, silentUpdate) {
    if (silentUpdate === undefined) silentUpdate = false;
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

  // ----- methods to parse the directory listings
  function isValidFilename(name) {
    return $.inArray(name, IGNORED_ELEMENTS) == -1;
  }

  function parseFilename(dir, name, type, branch) {
    if (!isValidFilename(name)) {
      return;
    }

    if(!name.startsWith(config.gluonPrefix)) {
      console.log('Unexpected file name: '+name+" ["+dir+"]");
      return;
    }

    rname = decodeURIComponent(name).substring(config.gluonPrefix.length);

    var version;
    if (rname.search(/[0-9]+.[0-9]+.[0-9]+-[0-9]{8}/) != -1) {
      // version with date in it (e.g. 0.8.0-20160502)
      version = rname.substring(0, rname.search('-')+9);
    } else {
      version = rname.substring(0, rname.search('-'));
    }
    rname = rname.substring(version.length+1);

    rname = rname.replace('-sysupgrade', '');
    rname = rname.replace(/\.bin$/, '');
    rname = rname.replace(/\.img$/, '');
    rname = rname.replace(/\.tar$/, '');

    var vendor;
    for (var v in vendormodels) {
      if (vendormodels.hasOwnProperty(v) && rname.startsWith(v)) {
        vendor = v;
        break;
      }
    }
    if (vendor === undefined) {
      console.log("Unknown vendor", name);
      return;
    }
    var vendorFullname = vendormodels[vendor].displayName;

    rname = rname.substring(vendor.length+1);

    var model, revision;
    for (var regex in vendormodels[vendor].models) {
      matches = (new RegExp("^"+regex)).exec(rname);
      if (matches === null) continue;

      if (!$.isArray(matches)) {
        console.log("[ERROR] matches is not an array", matches);
        return;
      }
      if (rname.length != matches[0].length) {
        console.log("[ERROR] device not parsed completely. Saw",
                    matches[0], "instead of", rname, "||", name);
        return;
      }

      model = vendormodels[vendor].models[regex];

      if (model == "--ignore--"){
        //console.log("ignoring", name);
        return;
      }

      // e.g. "(om5p-ac$)()": ["OM5P-AC", "v1"]
      // or   "(om5p-ac$)()": ["OM5P-AC"]
      if ($.isArray(model)) {
        if (model.length > 1) {
          revision = model[1];
        }
        model = model[0];
      }

      if (revision === undefined && matches.length == 3) {
        revision = matches[2];
        if (revision === "") revision = "alle";
      }

      if (model === undefined || revision === undefined) {
        console.log("Unable to parse model / revision", name);
        return;
      }
    }

    if (model === undefined) {
      console.log("Unknown model", rname, "|| vendor:", vendor, "||", name);
      return;
    }

    var routerRevision = {
      "revision": revision,
      "branch": branch,
      "type": type,
      "version": version,
      "location": dir+name
    };

    app.currentVersions[branch] = version;

    if(available_images.hasOwnProperty(vendor+model)) {
      available_images[vendor+model].revisions.push(routerRevision);
    } else {
      available_images[vendor+model] = {
        "vendor": vendor,
        "model": model,
        "revisions": [routerRevision]
      };
    }
  }

  function createOption(value, title, selectedOption) {
    var o = document.createElement('option');
    o.value = value;
    o.innerHTML = title;
    o.selected = (value === selectedOption);
    return o;
  }

  function getRevisions() {
    if (!available_images.hasOwnProperty(wizard.model) ||
        !available_images[wizard.model].revisions) {
      return -1;
    }

    if (!$.isArray(available_images[wizard.model].revisions)) {
      app.genericError();
      return -1;
    }

    return available_images[wizard.model].revisions;
  }

  // update all elements of the page according to the wizard object
  function updateHTML(wizard) {
    if (wizard.showFirmwareTable) {
      $('.firmwareTable').show();
      $('.wizard').hide();
    } else {
      $('.wizard').show();
      $('.firmwareTable').hide();
    }

    // ----- methods to show options -----
    function showVendors() {
      $('.vendorselect').html('');
      $('.vendorselect').append(
        createOption(-1, "-- Bitte Hersteller wählen --"));

      for (var vendor in vendormodels) {
        if (vendormodels.hasOwnProperty(vendor)) {
          if (vendor != 'x86') {
            $('.vendorselect').append(
              createOption(vendor, vendormodels[vendor].displayName,
                           wizard.vendor));
          }
        }
      }
    }
    showVendors();

    function showModels() {
      $('.modelselect').html('');
      $('.modelselect').append(
        createOption(-1, "-- Bitte Modell wählen --"));

      var sortedrouters = [];
      for(var key in available_images) {
        sortedrouters[sortedrouters.length] = key;
      }
      sortedrouters.sort();

      for (key in sortedrouters) {
        var r = sortedrouters[key];
        if (available_images.hasOwnProperty(r) &&
            available_images[r].vendor == wizard.vendor) {
          $('.modelselect').append(
            createOption(r, available_images[r].model, wizard.model));
        }
      }
    }
    showModels();

    function showRevisions() {
      $('.revisionselect').html('');
      var revisions = getRevisions();
      if (revision == -1) return;

      $('.revisionselect').append(
        createOption(-1, "-- Bitte Hardwarerevision wählen --",
                     wizard.revision));
      var addedRevs = [];
      for (var i in revisions) {
        var rev = revisions[i];
        if ($.inArray(rev.revision, addedRevs) == -1) {
          addedRevs.push(rev.revision);
          $('.revisionselect').append(
            createOption(rev.revision, rev.revision, wizard.revision));
        }
      }
    }
    showRevisions();

    function showImageTypes() {
      $('.typeselect').html('');
      var revisions = getRevisions();
      if (revision == -1) return;

      var addedTypes = [];
      for (var i in revisions) {
        var rev = revisions[i];
        if ($.inArray(rev.type, addedTypes) == -1) {
          addedTypes.push(rev.type);
          var displayType = config.typeNames[rev.type]||rev.type;
          $('.typeselect').append('<input type="radio" id="radiogroup-typeselect-'+rev.type+'" '+((rev.type == wizard.imageType)?'checked ':'')+'name="firmwareType" onclick="firmwarewizard.setImageType(\''+rev.type+'\');"><label for="radiogroup-typeselect-'+rev.type+'">'+displayType+'</label>');
        }
      }
    }
    showImageTypes();

    function showBranches() {
      if (wizard.revision == -1 || wizard.imageType == -1) {
        return;
      }
      var revisions = getRevisions();
      if (revision == -1) return;

      $('.branchselect').html('');
      $('.branch-experimental-dl').html('');
      for (var i in revisions) {
        var rev = revisions[i];
        if (rev.revision == wizard.revision && rev.type == wizard.imageType) {
          if (rev.branch == 'experimental') {
            $('.branchselect').append('<button class="btn abutton dl-expermental" onclick="$(\'.warning-experimental\').toggle();">'+rev.branch+' (' +rev.version+')</button>');
            $('.branch-experimental-dl').append('<a href="'+rev.location+'" class="abutton">Download für Experimentierfreudige</a>');
          } else {
            $('.branchselect').append('<a href="'+rev.location+'" class="abutton">'+rev.branch+' (' +rev.version+')</a>');
          }
        }
      }
    }
    showBranches();

    function updateHardwareSelection() {
      if (wizard.vendor == -1) {
        $('.modelselect').hide();
        $('.revisionselect').hide();
      } else {
        $('.modelselect').show();
        if (wizard.model == -1) {
          $('.revisionselect').hide();
        } else {
          $('.revisionselect').show();
        }
      }
    }
    updateHardwareSelection();

    function updatePanes() {
      var pane = PANE.MODEL;
      if (wizard.vendor != -1 && wizard.model != -1 && wizard.revision != -1) {
        pane = PANE.IMAGETYPE;
        if (wizard.imageType != -1) pane = PANE.BRANCH;
      }

      $('.tab-pane').removeClass('active');
      if (pane >= PANE.MODEL)     $('.tab-pane.step-model').addClass('active');
      if (pane >= PANE.IMAGETYPE) $('.tab-pane.step-type').addClass('active');
      if (pane >= PANE.BRANCH)    $('.tab-pane.step-branch').addClass('active');
    }
    updatePanes();

    $('.currentVersions').text(
      "Stable: "+app.currentVersions.stable+
      " // Beta: "+app.currentVersions.beta+
      " // Experimental: "+app.currentVersions.experimental);

    // === show the firmware table ===
    $(".firmwareTable table tbody").html('');
    var sortedrouters = [];
    for(var key in available_images) {
      sortedrouters[sortedrouters.length] = key;
    }
    sortedrouters.sort();

    for (key in sortedrouters) {
      var router = available_images[sortedrouters[key]];

      var vendorFullname = vendormodels[router.vendor].displayName ||
                           router.vendor;

      var upgradeHTML = {
        "stable": '',
        "beta": '',
        "experimental": ''
      };
      var factoryHTML = {
        "stable": '',
        "beta": '',
        "experimental": ''
      };

      for (var revisionId in router.revisions) {
        var revision = router.revisions[revisionId];
        var html = '[<a href="'+revision.location+'" title="'+revision.version+'">'+revision.revision+'</a>] ';

        if (revision.type == "sysupgrade") {
          upgradeHTML[revision.branch] += html;
        } else if (revision.type == "factory") {
          factoryHTML[revision.branch] += html;
        } else {
          app.genericError();
        }
      }

      var showStable = upgradeHTML.stable !== '' || factoryHTML.stable !== '';
      var showBeta   = upgradeHTML.beta !== '' || factoryHTML.beta !== '';
      var showExperimental = upgradeHTML.experimental !== '' ||
                             factoryHTML.experimental !== '';

      $(".firmwareTable table tbody").append(
        '<tr><td>'+vendorFullname+'</td><td>'+router.model+'</td><td>'+
        (showStable?'stable: '+(factoryHTML.stable||'-')+'<br>':'')+
        (showBeta?'beta: '+(factoryHTML.beta||'-')+'<br>':'')+
        (showExperimental?'experimental: '+(factoryHTML.experimental||'-'):'')+
        '</td>'+'<td>'+
        (showStable?'stable: '+(upgradeHTML.stable||'-')+'<br>':'')+
        (showBeta?'beta: '+(upgradeHTML.beta||'-')+'<br>':'')+
        (showExperimental?'experimental: '+(upgradeHTML.experimental||'-'):'')+
        '</td></tr>'
      );
    }
  }

  // parse the contents of the given directory
  function loadDirectory(branch, type, dir) {
    // retrieve the contents of the directory
    $.get(dir, function(data) {
      html = $.parseHTML(data);

      // parse filenames
      $(html).find("a").each(function(i, element){
        if (isValidFilename(element.getAttribute('href'))) {
          parseFilename(dir, element.getAttribute('href'), type, branch);
        }
      });

      updateHTML(wizard);
    });
  }

  loadDirectory('stable', 'factory',
                config.imageBasePath+'stable/factory/');
  loadDirectory('stable', 'sysupgrade',
                config.imageBasePath+'stable/sysupgrade/');
  loadDirectory('beta', 'factory',
                config.imageBasePath+'beta/factory/');
  loadDirectory('beta', 'sysupgrade',
                config.imageBasePath+'beta/sysupgrade/');
  loadDirectory('experimental', 'factory',
                config.imageBasePath+'experimental/factory/');
  loadDirectory('experimental', 'sysupgrade',
                config.imageBasePath+'experimental/sysupgrade/');

  return app;
}();
