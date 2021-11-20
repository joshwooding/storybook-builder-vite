const docGen = require('react-docgen-typescript');
const ts = require('typescript');
const glob = require('glob-promise');
const path = require('path');
const { generateDocgenCodeBlock } = require('@storybook/react-docgen-typescript-plugin/dist/generateDocgenCodeBlock');

/** Get the contents of the tsconfig in the system */
function getTSConfigFile(tsconfigPath) {
    try {
        const basePath = path.dirname(tsconfigPath);
        const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

        return ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            basePath,
            {},
            tsconfigPath
        );
    } catch (error) {
        return {};
    }
}

/** Create a glob matching function. */
function matchGlob(globs) {
    const matchers = (globs || []).map((g) => glob(g, { dot: true }));

    return async (filename) =>  {
        const matches = (await Promise.all(matchers))[0] || [];
        return Boolean(filename && matches.find((match) => path.normalize(filename) === path.join(process.cwd(), match)));
    }

}

function getOptions(options){
    const {
        tsconfigPath = "./tsconfig.json",
        compilerOptions: userCompilerOptions,
        docgenCollectionName,
        setDisplayName,
        typePropName,
        ...docgenOptions
    } = options;

    let compilerOptions = {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.Latest,
    };

    if (userCompilerOptions) {
        compilerOptions = {
            ...compilerOptions,
            ...userCompilerOptions,
        };
    } else {
        const { options: tsOptions } = getTSConfigFile(tsconfigPath);
        compilerOptions = { ...compilerOptions, ...tsOptions };
    }

    return {
        docgenOptions,
        generateOptions: {
            docgenCollectionName: docgenCollectionName || "STORYBOOK_REACT_CLASSES",
            setDisplayName: setDisplayName || true,
            typePropName: typePropName || "type",
        },
        compilerOptions,
    };
}

module.exports = function (pluginOptions) {

    const {
        docgenOptions,
        compilerOptions,
        generateOptions,
    } = getOptions(pluginOptions);
    const docGenParser = docGen.withCompilerOptions(
        compilerOptions,
        docgenOptions
    );
    const { exclude = ["**/**.stories.tsx"], include = ["**/**.tsx"] } = docgenOptions;
    const isExcluded = matchGlob(exclude);
    const isIncluded = matchGlob(include);

    const files = (
            include.map((filePath) =>
                glob.sync(path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath))
            )
    ).reduce((carry, files) => carry.concat(files), []);
    const tsProgram = ts.createProgram(
        files,
        compilerOptions
    );

    return {
        name: 'react-docgen-typescript',

        async transform(src, id) {
            if(!await isExcluded(id) && await isIncluded(id)) {
                const componentDocs = docGenParser.parseWithProgramProvider(id, () => tsProgram);

                if (!componentDocs.length) {
                    return src;
                }

                const docs = generateDocgenCodeBlock({
                    filename: id,
                    source: src,
                    componentDocs,
                    ...generateOptions,
                });

                return { code: docs, map: null };
            }

        },
    };
};
