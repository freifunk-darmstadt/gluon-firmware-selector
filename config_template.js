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
  // list images on console that match no model
  listMissingImages: false,
  // see devices.js for different vendor model maps
  vendormodels: vendormodels,
  // set enabled categories of devices (see devices.js)
  enabled_device_categories: ["recommended"],
  // Display a checkbox that allows to display not recommended devices.
  // This only make sense if enabled_device_categories also contains not
  // recommended devices.
  recommended_toggle: false,
  // Optional link to an info page about no longer recommended devices
  recommended_info_link: null,
  // community prefix of the firmware images
  community_prefix: 'gluon-ffda-',
  // firmware version regex
  version_regex: '-([0-9]+.[0-9]+.[0-9]+([+-~][0-9]+)?)[.-]',
  // relative image paths and branch
  directories: {
    // some demo sources
    './images/stable/gluon-factory-example.html': 'stable',
    './images/stable/gluon-other-example.html': 'stable',
    './images/stable/gluon-sysupgrade-example.html': 'stable',
    './images/beta/gluon-factory-example.html': 'beta',
    './images/beta/gluon-other-example.html': 'beta',
    './images/beta/gluon-sysupgrade-example.html': 'beta',
    './images/testing/gluon-factory-example.html': 'testing',
    './images/testing/gluon-other-example.html': 'testing',
    './images/testing/gluon-sysupgrade-example.html': 'testing',
  },
  // page title
  title: 'Firmware',
  // branch descriptions shown during selection
  branch_descriptions: {
    stable: 'Gut getestet, zuverlässig und stabil.',
    beta: 'Vorabtests neuer Stable-Kandidaten.',
    testing: 'Ungetestet, automatisch generiert.'
  },
  // recommended branch will be marked during selection
  recommended_branch: 'stable',
  // experimental branches (show a warning for these branches)
  experimental_branches: ['experimental'],
  // path to preview pictures directory
  preview_pictures: 'pictures/',
  preview_pictures_ext: '.jpg',
  // link to changelog
  changelog: 'CHANGELOG.html',
  // links for instructions like flashing of certain devices (optional)
  // can be set for a whole model or individual revisions
  // overwrites default values from devices_info in devices.js
  // devices_info: {
  //   'AVM': {
  //     "FRITZ!Box 4040": "https://fritz-tools.readthedocs.io"
  //   },
  //   "TP-Link": {
  //     "TL-WR841N/ND": {"v13": "https://wiki.freifunk.net/TP-Link_WR841ND/Flash-Anleitung_v13"}
  //   }
  // }
};
