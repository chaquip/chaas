{
  description = "Chaas development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        myNode = pkgs.nodejs_22;
        myYarn = pkgs.yarn.override { nodejs = myNode; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            myNode
            myYarn
            pkgs.jdk21_headless
            pkgs.firebase-tools
            pkgs.jq
          ];

          shellHook = ''
            echo "Chaas dev environment loaded"
            echo "  Node:     $(node --version)"
            echo "  Yarn:     $(yarn --version)"
            echo "  Java:     $(java --version 2>&1 | head -1)"
            echo "  Firebase: $(firebase --version)"
            echo ""
            echo "Commands:"
            echo "  yarn dev            — Start dev server + emulators"
            echo "  yarn fixtures       — Load test data"
            echo "  yarn test:unit      — Run unit tests"
            echo "  yarn test:integration — Run integration tests"
          '';
        };
      }
    );
}
