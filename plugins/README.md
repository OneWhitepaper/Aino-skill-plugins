# Plugins

No plugins have been published yet. Add a real plugin directory here when its
implementation and install requirements are ready. Do not add placeholder
packages just to populate the website.

Each published plugin needs `catalog.json`, `plugin.yaml`, a `README.md`, and
the actual implementation. `catalog.json` uses the shared fields documented
in the repository README. Its `kind` is `plugin`; the build generates a GitHub
repository/subdirectory identifier targeting `main` (not an immutable pin). Plugin installation and compatibility
must be checked in the target Aino release before claiming support.
