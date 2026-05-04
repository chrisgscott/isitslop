import re
from tools.file_scanner import ScannedFile, ScanResult
from tools.analyzers.error_handling import analyze_error_handling
from tools.analyzers.test_coverage import analyze_test_coverage
from tools.analyzers.documentation import analyze_documentation
from tools.analyzers.security import analyze_security
from tools.analyzers.code_structure import analyze_code_structure
from tools.analyzers.dependencies import analyze_dependencies


def _make_file(path: str, content: str, ext: str = ".ts") -> ScannedFile:
    return ScannedFile(
        path=path, extension=ext, language="typescript",
        loc=len(content.splitlines()), content=content, is_test=False,
    )


class TestErrorHandling:
    def test_detects_empty_catch(self):
        file = _make_file("app.ts", "try { foo() } catch (e) { }")
        findings = analyze_error_handling([file])
        issues = [f["issue"] for f in findings]
        assert any("empty catch" in i.lower() for i in issues)

    def test_detects_console_log_density(self):
        content = "\n".join([f"console.log('line {i}')" for i in range(10)])
        file = _make_file("app.ts", content)
        findings = analyze_error_handling([file])
        issues = [f["issue"] for f in findings]
        assert any("console.log" in i.lower() for i in issues)

    def test_no_findings_for_clean_code(self):
        file = _make_file("app.ts", "export function add(a, b) { return a + b; }")
        findings = analyze_error_handling([file])
        assert len(findings) == 0

    def test_skips_test_files(self):
        file = ScannedFile(
            path="app.test.ts", extension=".ts", language="typescript",
            loc=1, content="try { foo() } catch (e) { }", is_test=True,
        )
        findings = analyze_error_handling([file])
        assert len(findings) == 0

    def test_skips_console_log_density_in_scripts_dir(self):
        """CLI scripts in scripts/ use console.log as their output mechanism."""
        content = "\n".join([f"console.log('step {i}')" for i in range(20)])
        file = _make_file("scripts/bump-version.ts", content)
        findings = analyze_error_handling([file])
        density_findings = [f for f in findings if "console.log density" in f["issue"].lower()]
        assert len(density_findings) == 0

    def test_skips_console_log_density_in_build_configs(self):
        """Build tool configs (vite, webpack, etc.) use console.log for dev-server logging."""
        content = "\n".join([f"console.log('proxy {i}')" for i in range(15)])
        for config_name in ["vite.config.ts", "webpack.config.js", "rollup.config.mjs", "vitest.config.ts"]:
            file = _make_file(config_name, content)
            findings = analyze_error_handling([file])
            density_findings = [f for f in findings if "console.log density" in f["issue"].lower()]
            assert len(density_findings) == 0, f"Should skip {config_name}"

    def test_catch_console_warn_gets_low_severity(self):
        """console.warn in catch blocks is often intentional graceful degradation."""
        content = "try { foo() } catch (e) { console.warn('fallback:', e) }"
        file = _make_file("clipboard.ts", content)
        findings = analyze_error_handling([file])
        catch_findings = [f for f in findings if "catch" in f["issue"].lower()]
        assert len(catch_findings) == 1
        assert catch_findings[0]["severity"] == "low"
        assert "graceful degradation" in catch_findings[0]["issue"].lower()

    def test_catch_console_log_stays_medium_severity(self):
        """console.log in catch blocks is likely debug leftover — stays medium."""
        content = "try { foo() } catch (e) { console.log('error:', e) }"
        file = _make_file("app.ts", content)
        findings = analyze_error_handling([file])
        catch_findings = [f for f in findings if "catch" in f["issue"].lower()]
        assert len(catch_findings) == 1
        assert catch_findings[0]["severity"] == "medium"

    def test_ignores_catch_inside_string_literal(self):
        """Pattern matches inside string literals should be ignored."""
        content = '"Searching for error handling (found: catch(e) {})..."'
        file = _make_file("messages.ts", content)
        findings = analyze_error_handling([file])
        assert len(findings) == 0

    def test_skips_docs_api_assets_empty_catch(self):
        """Generated doc-tool JS assets (TypeDoc, JSDoc) shouldn't be flagged."""
        content = "!function(){try{foo()}catch(e){}}();"
        file = _make_file("docs/api/assets/js/main.js", content, ext=".js")
        findings = analyze_error_handling([file])
        assert len(findings) == 0

    def test_skips_docs_includes_console_log(self):
        """Documentation example/include files use console.log as demos."""
        content = "\n".join([f"console.log('example {i}')" for i in range(15)])
        file = _make_file("docs/_includes/projects/demo/my-element.js", content, ext=".js")
        findings = analyze_error_handling([file])
        density_findings = [f for f in findings if "console.log density" in f["issue"].lower()]
        assert len(density_findings) == 0


class TestTestCoverage:
    def test_detects_no_tests(self):
        files = [_make_file("app.ts", "const x = 1;")]
        result = ScanResult(files=files, total_files=1, total_loc=1, package_json={"scripts": {}})
        findings = analyze_test_coverage(result)
        assert any("no test" in f["issue"].lower() for f in findings)

    def test_detects_no_test_script(self):
        files = [_make_file("app.ts", "const x = 1;")]
        result = ScanResult(files=files, total_files=1, total_loc=1, package_json={"scripts": {"start": "node app.js"}})
        findings = analyze_test_coverage(result)
        assert any("test script" in f["issue"].lower() for f in findings)

    def test_detects_low_test_ratio(self):
        source_files = [_make_file(f"src/file{i}.ts", "const x = 1;\n" * 50) for i in range(10)]
        test_files = [ScannedFile(path="test/one.test.ts", extension=".ts", language="typescript", loc=5, content="test('x', () => {})", is_test=True)]
        result = ScanResult(files=source_files + test_files, total_files=11, total_loc=505, package_json={"scripts": {"test": "vitest"}})
        findings = analyze_test_coverage(result)
        assert any("ratio" in f["issue"].lower() for f in findings)

    def test_clean_project_no_critical(self):
        source_files = [_make_file(f"src/file{i}.ts", "const x = 1;\n" * 10) for i in range(3)]
        test_files = [ScannedFile(path=f"test/file{i}.test.ts", extension=".ts", language="typescript", loc=10, content="test('x', () => {})", is_test=True) for i in range(3)]
        result = ScanResult(files=source_files + test_files, total_files=6, total_loc=60, package_json={"scripts": {"test": "vitest"}})
        findings = analyze_test_coverage(result)
        critical = [f for f in findings if f["severity"] == "critical"]
        assert len(critical) == 0


class TestDocumentation:
    def test_detects_no_readme(self):
        result = ScanResult(files=[], total_files=1, total_loc=100, has_readme=False, readme_content="")
        findings = analyze_documentation(result)
        assert any("readme" in f["issue"].lower() for f in findings)

    def test_detects_empty_readme(self):
        result = ScanResult(files=[], total_files=1, total_loc=100, has_readme=True, readme_content="# My Project\n")
        findings = analyze_documentation(result)
        assert any("thin" in f["issue"].lower() or "short" in f["issue"].lower() for f in findings)


class TestSecurity:
    def test_detects_hardcoded_secrets(self):
        file = _make_file("config.ts", 'const API_KEY = "sk-1234567890abcdef1234567890abcdef"')
        findings = analyze_security([file])
        assert any("secret" in f["issue"].lower() or "key" in f["issue"].lower() for f in findings)

    def test_detects_env_file(self):
        file = ScannedFile(path=".env", extension="", language=None, loc=1, content="API_KEY=secret123", is_test=False)
        findings = analyze_security([file])
        assert any(".env" in f["issue"].lower() for f in findings)

    def test_no_findings_for_clean_code(self):
        file = _make_file("app.ts", "const x = process.env.API_KEY;")
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_e2e_setup_scripts(self):
        file = ScannedFile(
            path="scripts/setup-e2e.sh", extension=".sh", language="bash",
            loc=40, content='PASSWORD="${RANDOM_BASE}Aa1@"\nPASSWORD="$GENERATED_PASSWORD"',
            is_test=False,
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_shell_variable_passwords(self):
        file = ScannedFile(
            path="scripts/deploy.sh", extension=".sh", language="bash",
            loc=10, content='password="$DB_PASSWORD"',
            is_test=False,
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_algolia_keys_in_docusaurus(self):
        file = _make_file(
            "docs/docusaurus.config.js",
            'apiKey: "b2ec302e9880e8979ad6a1234567890"',
            ext=".js",
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_docs_src_tutorial_secrets(self):
        """Tutorial/example code in docs_src/ directories uses placeholder secrets."""
        file = _make_file(
            "docs_src/security/tutorial004.py",
            'SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"',
            ext=".py",
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_examples_directory_secrets(self):
        """Example directories contain demo code with fake credentials."""
        file = _make_file(
            "examples/auth/config.ts",
            'const password = "example-password-here"',
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_mdx_documentation_files(self):
        """MDX docs files with example passwords/keys shouldn't be flagged."""
        file = ScannedFile(
            path="apps/docs/content/docs/self-hosting/email.mdx",
            extension=".mdx", language=None,
            loc=50, content='PASSWORD="your-smtp-password"\nAPI_KEY="re_xxxxxxxxxxxxxxxxxx"',
            is_test=False,
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_env_example_files(self):
        """`.env.example` files contain placeholder secrets, not real ones."""
        file = ScannedFile(
            path=".env.example", extension=".example", language=None,
            loc=5, content='DATABASE_PASSWORD="password"\nAPI_KEY="sk-placeholder1234567890abcdef"',
            is_test=False,
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_placeholder_passwords(self):
        """Placeholder passwords like 'your-password' aren't real secrets."""
        file = _make_file("mailer.ts", "password = 'your-password'")
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_error_code_password_constants(self):
        """UPPER_SNAKE_CASE password values are error codes, not secrets."""
        file = _make_file("errors.ts", "Password: 'INCORRECT_PASSWORD'")
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_dockerfile_dummy_api_keys(self):
        """Dockerfiles with dummy/placeholder build-time API keys aren't real secrets."""
        file = ScannedFile(
            path="docker/Dockerfile.local", extension="", language=None,
            loc=20, content='ARG API_KEY="dummy_apikey_for_build_only"',
            is_test=False,
        )
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_skips_placeholder_secret_values(self):
        """Values containing 'dummy', 'fake', 'test', etc. are not real secrets."""
        file = _make_file("config.ts", 'const api_key = "fake_key_for_testing_purposes_only"')
        findings = analyze_security([file])
        assert len(findings) == 0

    def test_still_catches_real_hardcoded_passwords(self):
        file = _make_file("config.ts", 'const password = "supersecret123"')
        findings = analyze_security([file])
        assert any("password" in f["issue"].lower() for f in findings)


class TestCodeStructure:
    def test_detects_god_file(self):
        content = "\n".join([f"const line{i} = {i};" for i in range(500)])
        file = _make_file("god.ts", content)
        findings = analyze_code_structure([file])
        assert any("large" in f["issue"].lower() or "god" in f["issue"].lower() for f in findings)

    def test_detects_deep_nesting(self):
        content = "if (a) {\n  if (b) {\n    if (c) {\n      if (d) {\n        if (e) {\n          x();\n        }\n      }\n    }\n  }\n}"
        file = _make_file("nested.ts", content)
        findings = analyze_code_structure([file])
        assert any("nest" in f["issue"].lower() for f in findings)


    def test_ignores_jsx_structural_nesting(self):
        content = """function App() {
  return (
    <Provider>
      <Layout>
        <Sidebar>
          <Nav>
            <Item>Hello</Item>
          </Nav>
        </Sidebar>
      </Layout>
    </Provider>
  )
}"""
        file = _make_file("app.tsx", content)
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) == 0

    def test_ignores_config_object_nesting(self):
        content = """const config = {
  theme: {
    colors: {
      primary: {
        100: '#fff',
        200: '#eee',
        300: '#ddd',
        dark: {
          100: '#333',
          200: '#222',
        }
      }
    }
  }
}"""
        file = _make_file("config.ts", content)
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) == 0

    def test_ignores_single_line_early_returns(self):
        """Single-line if statements (early returns/guards) should not count as nesting."""
        content = """function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}"""
        file = _make_file("utils.ts", content)
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) == 0

    def test_skips_barrel_files_for_god_file(self):
        """Barrel files that just re-export shouldn't be flagged as god files."""
        lines = [f"export {{ Thing{i} }} from './thing{i}'" for i in range(200)]
        content = "\n".join(lines)
        file = _make_file("index.ts", content)
        file.is_barrel = True
        findings = analyze_code_structure([file])
        god_file_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_file_findings) == 0

    def test_skips_generated_files(self):
        content = "\n".join([f"const line{i} = {i};" for i in range(500)])
        file = _make_file("generated.ts", content)
        file.is_generated = True
        findings = analyze_code_structure([file])
        assert len(findings) == 0

    def test_skips_data_files_for_god_file(self):
        content = "\n".join([f'"key{i}": "value{i}",' for i in range(500)])
        file = _make_file("locales/en.ts", content)
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_template_literal_content_files(self):
        """Files with mostly template literal content (demo data, markdown) aren't god files."""
        content = 'export const DOCS = [\n  {\n    name: "doc.md",\n    content: `\n'
        content += "\n".join([f"Line {i} of markdown content" for i in range(500)])
        content += "\n`\n  }\n];"
        file = _make_file("lib/demo/content.ts", content)
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_content_named_files(self):
        """Files named content.ts, fixture.ts, etc. are data files."""
        content = "\n".join([f"const x{i} = {i};" for i in range(500)])
        file = _make_file("lib/content.ts", content)
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_template_dir_duplicates(self):
        """Template variant files (base.tsx, with-auth.tsx) aren't real duplicates."""
        files = [
            _make_file(f"cli/template/extras/src/{variant}.tsx", f"export default function {variant}() {{ return <div>{variant}</div> }}")
            for variant in ["base", "with-auth", "with-better-auth"]
        ]
        findings = analyze_code_structure(files)
        dup_findings = [f for f in findings if "similar names" in f["issue"].lower()]
        assert len(dup_findings) == 0

    def test_skips_docs_src_duplicates(self):
        """docs_src/ tutorial variants (tutorial001.py, tutorial001_py310.py) aren't duplicates."""
        files = [
            _make_file(f"docs_src/security/tutorial004{suffix}.py", "SECRET_KEY = 'fake'\ndef verify():\n    pass", ext=".py")
            for suffix in ["", "_py310", "_an_py310"]
        ]
        findings = analyze_code_structure(files)
        dup_findings = [f for f in findings if "similar names" in f["issue"].lower()]
        assert len(dup_findings) == 0

    def test_skips_storybook_story_files(self):
        """Storybook .stories.tsx files are demo code, not production code."""
        content = "\n".join([f"const line{i} = {i};" for i in range(500)])
        file = _make_file("components/sidebar.stories.tsx", content, ext=".tsx")
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_monorepo_config_duplicates(self):
        """Config files duplicated across monorepo apps/ dirs are expected."""
        files = [
            _make_file(f"apps/{app}/next.config.ts", "const config = { reactStrictMode: true };\nexport default config;")
            for app in ["web", "admin", "api"]
        ]
        findings = analyze_code_structure(files)
        dup_findings = [f for f in findings if "similar names" in f["issue"].lower()]
        assert len(dup_findings) == 0

    def test_skips_dotted_config_duplicates(self):
        """Dotted config files like .eslintrc.cjs duplicated across monorepo workspaces are expected."""
        shared_content = "module.exports = {\n  root: true,\n  parser: '@typescript-eslint/parser',\n  rules: { 'no-unused-vars': 'warn' }\n};"
        files = [
            _make_file(f"apps/{app}/.eslintrc.cjs", shared_content, ext=".cjs")
            for app in ["web", "admin", "api", "docs"]
        ]
        findings = analyze_code_structure(files)
        dup_findings = [f for f in findings if "similar names" in f["issue"].lower()]
        assert len(dup_findings) == 0

    def test_skips_build_tool_config_duplicates(self):
        """Build tool configs (vitest, tsup, lint-staged) duplicated across workspaces are expected."""
        shared_content = "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { globals: true } });"
        for config_name in ["vitest.config.ts", "tsup.config.ts", "lint-staged.config.js"]:
            files = [
                _make_file(f"packages/{pkg}/{config_name}", shared_content)
                for pkg in ["core", "utils", "db", "auth"]
            ]
            findings = analyze_code_structure(files)
            dup_findings = [f for f in findings if "similar names" in f["issue"].lower()]
            assert len(dup_findings) == 0, f"Should skip duplicates for {config_name}"

    def test_skips_seed_dir_for_god_file(self):
        """Files in prisma/seed/ directories are data files, not god files."""
        content = "\n".join([f'"item{i}": {{ "name": "thing{i}" }},' for i in range(500)])
        file = _make_file("packages/database/prisma/seed/data.ts", content)
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_well_documented_file_under_code_threshold(self):
        """Files with lots of comments/docstrings shouldn't be flagged if code lines are under threshold."""
        code_lines = [f"const line{i} = {i};" for i in range(200)]
        comment_lines = [f"// This documents line {i}" for i in range(200)]
        blank_lines = [""] * 100
        # 500 total lines but only 200 are code
        content = "\n".join(code_lines + comment_lines + blank_lines)
        file = _make_file("well-documented.ts", content)
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_python_file_heavy_on_docstrings(self):
        """Python files with extensive docstrings shouldn't be penalized."""
        methods = []
        for i in range(50):
            methods.append(f'    def method_{i}(self):\n        """\n        This is a detailed docstring\n        explaining what method_{i} does.\n        Args:\n            none\n        Returns:\n            int\n        """\n        return {i}')
        content = "class MyAPI:\n" + "\n\n".join(methods)
        file = ScannedFile(
            path="api.py", extension=".py", language="python",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_python_nesting_ignores_streamlit_layout(self):
        """Streamlit with-blocks (st.sidebar, st.expander, st.container) are layout, not control flow."""
        content = """import streamlit as st

def main():
    with st.sidebar:
        query = st.text_input("Search")
        if query:
            with st.spinner("Loading..."):
                results = search(query)
                if results:
                    with st.expander("Citations"):
                        for cite in results:
                            st.write(cite)
"""
        file = ScannedFile(
            path="app.py", extension=".py", language="python",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        # Only 3 real control flow levels: if > if > for
        # The 3 with-blocks are Streamlit layout, not control flow
        assert len(nesting_findings) == 0

    def test_python_nesting_counts_resource_with_blocks(self):
        """Resource management with-blocks (open(), lock, connection) ARE control flow."""
        content = """def process():
    with open("file.txt") as f:
        for line in f:
            if line.strip():
                with db.transaction():
                    if validate(line):
                        if save(line):
                            log(line)
"""
        file = ScannedFile(
            path="processor.py", extension=".py", language="python",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        # 6 levels: with > for > if > with > if > if
        assert len(nesting_findings) > 0

    def test_python_nesting_depth_accuracy(self):
        """Verify the counter reports exact depth, not an undercount."""
        # Exactly 6 levels of control flow nesting
        content = """def process(items):
    for item in items:
        if item.valid:
            try:
                if item.type == 'a':
                    for sub in item.children:
                        if sub.active:
                            handle(sub)
            except Exception:
                pass
"""
        file = ScannedFile(
            path="deep.py", extension=".py", language="python",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) > 0
        # Should report exactly 6 levels (for > if > try > if > for > if)
        depth_match = re.search(r'\((\d+) levels\)', nesting_findings[0]["issue"])
        assert depth_match, f"Could not parse depth from: {nesting_findings[0]['issue']}"
        assert int(depth_match.group(1)) == 6

    def test_js_nesting_depth_accuracy(self):
        """Verify JS/TS counter reports exact depth."""
        # Exactly 5 levels of control flow
        content = """if (a) {
  for (let i = 0; i < n; i++) {
    if (b) {
      try {
        if (c) {
          doSomething();
        }
      } catch (e) {
        handle(e);
      }
    }
  }
}"""
        file = _make_file("deep.ts", content)
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) > 0
        depth_match = re.search(r'\((\d+) levels\)', nesting_findings[0]["issue"])
        assert depth_match, f"Could not parse depth from: {nesting_findings[0]['issue']}"
        assert int(depth_match.group(1)) == 5

    def test_skips_fixture_files_for_nesting(self):
        """Files in fixtures/ directories are test data and shouldn't be flagged for deep nesting."""
        content = "if (a) {\n  if (b) {\n    if (c) {\n      if (d) {\n        if (e) {\n          if (f) {\n            x();\n          }\n        }\n      }\n    }\n  }\n}"
        file = _make_file("packages/plugin/rules/indent/fixtures/indent-invalid-fixture-1.js", content, ext=".js")
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) == 0

    def test_python_nesting_counts_control_flow_only(self):
        """Python nesting should count control flow depth, not raw indentation."""
        content = """class MyService:
    def process(self, items):
        for item in items:
            if item.valid:
                if item.type == 'a':
                    do_something()
"""
        file = ScannedFile(
            path="service.py", extension=".py", language="python",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        # 3 levels of control flow (for > if > if), not 5 from raw indent
        assert len(nesting_findings) == 0


    def test_skips_html_files_for_god_file(self):
        """HTML files are markup, not code - shouldn't be flagged as god files."""
        content = "\n".join([f"<div>line {i}</div>" for i in range(1500)])
        file = ScannedFile(
            path="docs/api/classes/litelement.html", extension=".html", language="html",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        god_findings = [f for f in findings if "large" in f["issue"].lower()]
        assert len(god_findings) == 0

    def test_skips_html_files_for_nesting(self):
        """HTML files shouldn't be analyzed for nesting depth."""
        content = "if (a) {\n  if (b) {\n    if (c) {\n      if (d) {\n        if (e) {\n          x();\n        }\n      }\n    }\n  }\n}"
        file = ScannedFile(
            path="docs/api/assets/js/page.html", extension=".html", language="html",
            loc=len(content.splitlines()), content=content, is_test=False,
        )
        findings = analyze_code_structure([file])
        nesting_findings = [f for f in findings if "nest" in f["issue"].lower()]
        assert len(nesting_findings) == 0

    def test_skips_django_urls_duplicates(self):
        """Django urls.py files duplicated across apps are a framework convention."""
        shared_content = "from django.urls import path\nurlpatterns = [\n    path('api/', include('app.urls')),\n]"
        files = [
            ScannedFile(
                path=f"app_dir/{app}/urls.py", extension=".py", language="python",
                loc=3, content=shared_content, is_test=False,
            )
            for app in ["module", "user", "auth", "api"]
        ]
        findings = analyze_code_structure(files)
        dup_findings = [f for f in findings if "similar names" in f["issue"].lower()]
        assert len(dup_findings) == 0


class TestDependencies:
    def test_detects_too_many_deps(self):
        deps = {f"dep-{i}": "^1.0.0" for i in range(65)}
        pkg = {"dependencies": deps, "devDependencies": {}}
        findings = analyze_dependencies(pkg, total_loc=500)
        assert any("dependencies" in f["issue"].lower() for f in findings)

    def test_detects_missing_lock_file(self):
        pkg = {"dependencies": {"react": "^18.0.0"}}
        findings = analyze_dependencies(pkg, total_loc=100, has_lock_file=False)
        assert any("lock" in f["issue"].lower() for f in findings)

    def test_detects_duplicate_purpose(self):
        pkg = {"dependencies": {"axios": "^1.0.0", "node-fetch": "^3.0.0"}, "devDependencies": {}}
        findings = analyze_dependencies(pkg, total_loc=100)
        assert any("duplicate" in f["issue"].lower() for f in findings)
