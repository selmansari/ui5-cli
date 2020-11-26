const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const {Prompt} = require("enquirer");

const createFramework = require("../../../../lib/framework/create");
const ui5Project = require("@ui5/project");
const ui5Fs = require("@ui5/fs");
const FileSystem = require("@ui5/fs/lib/adapters/FileSystem");

const projectTree = {
	metadata: {
		namespace: "sample"
	},
	dependencies: [{
		id: "fake-dependency",
		metadata: {
			namespace: "sample"
		},
		type: "library",
		dependencies: []
	}],
	type: "application"
};
const libraryCollection = {
	dependencies: {
		_readers: [
			new FileSystem({
				virBasePath: "resources/sample/",
				project: {
					type: "library"
				},
				fsBasePath: "/resources/sample",
				excludes: []
			})
		]
	}
};
const themelibraryCollection = {
	dependencies: {
		_readers: [
			new FileSystem({
				virBasePath: "resources/sample/",
				project: {
					type: "themelib",
					metadata: {
						name: "themelib_sap_fancy_theme"
					}
				},
				fsBasePath: "/resources/sample",
				excludes: []
			})
		]
	}
};
const resource = [{
	_path: "sample",
	_project: {
		metadata: {
			name: "sample"
		}
	}
}];


async function assertCreateHandler(t, {argv, expectedMessage, expectedMetaInfo, expectedConsoleLog, project}) {
	const frameworkCreateStub = sinon.stub(createFramework, "create").resolves({
		statusMessage: expectedMessage
	});

	const createCommand = mock.reRequire("../../../../lib/cli/commands/create");
	await createCommand.handler(argv);

	t.is(frameworkCreateStub.callCount, 1, "Create function should be called");
	t.deepEqual(frameworkCreateStub.getCall(0).args, [
		{
			name: argv["name"],
			metaInformation: expectedMetaInfo,
			project: project
		}],
	"Create function should be called with expected args");

	t.is(t.context.consoleLogStub.callCount, expectedConsoleLog.length,
		"console.log should be called " + expectedConsoleLog.length + " times");
	expectedConsoleLog.forEach((expectedLog, i) => {
		t.deepEqual(t.context.consoleLogStub.getCall(i).args, [expectedLog],
			"console.log should be called with expected string on call index " + i);
	});
}

async function assertFailingCreateHandler(t, {argv, expectedMessage, expectedCallCount}) {
	const frameworkCreateStub = sinon.stub(createFramework, "create").resolves({
		statusMessage: undefined
	});

	const createCommand = mock.reRequire("../../../../lib/cli/commands/create");
	const exception = await t.throwsAsync(createCommand.handler(argv));

	t.is(exception.message, expectedMessage, "Create handler should throw expected error");
	t.is(frameworkCreateStub.callCount, expectedCallCount, "Create function should not be called");
}

test.beforeEach((t) => {
	t.context.generateDependencyTreeStub = sinon.stub(ui5Project.normalizer, "generateDependencyTree");
	t.context.processProjectStub = sinon.stub(ui5Project.projectPreprocessor, "processTree");
	t.context.generateProjectTreeStub = sinon.stub(ui5Project.normalizer, "generateProjectTree").resolves(projectTree);
	t.context.createCollectionsForTreeStub = sinon.stub(ui5Fs.resourceFactory, "createCollectionsForTree");
	t.context.byGlobStub = sinon.stub(ui5Fs.AbstractReader.prototype, "byGlob");
	t.context.runStub = sinon.stub(Prompt.prototype, "run");
	mock("../../../../lib/framework/add", sinon.stub());

	t.context.consoleLogStub = sinon.stub(console, "log");
});

test.afterEach.always(() => {
	mock.stopAll();
	sinon.restore();
});

test.serial("Rejects on no component provided", async (t) => {
	const {createCollectionsForTreeStub, generateDependencyTreeStub, processProjectStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application"
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create"]
		},
		expectedMessage: "Component needed. You can run " +
			"this command without component in interactive mode (--interactive, -i)",
		expectedCallCount: 0
	});
});

test.serial("Rejects on no name provided", async (t) => {
	const {createCollectionsForTreeStub, generateDependencyTreeStub, processProjectStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application"
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create", "view"]
		},
		expectedMessage: "Missing mandatory parameter 'name'. You can run " +
		"this command without name in interactive mode (--interactive, -i)",
		expectedCallCount: 0
	});
});

test.serial("Rejects on other project type ", async (t) => {
	const {generateDependencyTreeStub, processProjectStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "xy"
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);

	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test"
		},
		expectedMessage: "Failed to read project: " +
			"Create command is currently only supported for projects of type application",
		expectedCallCount: 0
	});
});

test.serial("Rejects on no message", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test"
		},
		expectedMessage: "Internal error while adding component",
		expectedCallCount: 1
	});
});

test.serial("Rejects on other message", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test"
		},
		expectedMessage: "Internal error while adding component",
		expectedCallCount: 1
	});
});

test.serial("Rejects on add default view with invalid namespace", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};

	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	byGlobStub.resolves(resource);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: true,
			namespaces: ["xy"],
			route: false,
		},
		expectedMessage: "No valid library/module provided. Use 'ui5 add' to add the needed library.",
		expectedCallCount: 0
	});
});

test.serial("Rejects on add controller with invalid module", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};

	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	byGlobStub.resolves(resource);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertFailingCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: true,
			modules: ["xy"],
			route: false,
		},
		expectedMessage: "No valid library/module provided. Use 'ui5 add' to add the needed library.",
		expectedCallCount: 0
	});
});

test.serial("Add raw view as root", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}

	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: false,
			route: false,
			root: true
		},
		expectedMessage: "Add new view",
		expectedMetaInfo: {
			controller: false,
			moduleList: [],
			namespaceList: [],
			rootView: true,
			route: false,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view"],
		project: project
	});
});

test.serial("Add default view", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: true,
			route: false,
		},
		expectedMessage: "Add new view with corresponding controller",
		expectedMetaInfo: {
			controller: true,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: false,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view with corresponding controller"],
		project: project
	});
});

test.serial("Add default view with route", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: true,
			route: true,
		},
		expectedMessage: "Add new view with corresponding controller and route to project",
		expectedMetaInfo: {
			controller: true,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: true,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view with corresponding controller and route to project"],
		project: project
	});
});

test.serial("Add to existing view an route", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: true,
			route: true,
		},
		expectedMessage: "Add route to view",
		expectedMetaInfo: {
			controller: true,
			moduleList: [],
			namespaceList: [],
			route: true,
			rootView: undefined,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add route to view"],
		project: project
	});
});

test.serial("Add default view with valid namespace", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub,
		createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};

	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: true,
			namespaces: ["sample"],
			route: false,
		},
		expectedMessage: "Add new view with corresponding controller",
		expectedMetaInfo: {
			controller: true,
			moduleList: [],
			namespaceList: [{name: "sample"}],
			rootView: undefined,
			route: false,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view with corresponding controller"],
		project: project
	});
});

test.serial("Add default view with no namespace", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub,
		createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};

	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			name: "test",
			controller: false,
			namespaces: ["sap.m"],
			route: false,
		},
		expectedMessage: "Add new view",
		expectedMetaInfo: {
			controller: false,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: false,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view"],
		project: project
	});
});

test.serial("Add controller", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "controller"],
			name: "test"
		},
		expectedMessage: "Add new controller",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: undefined,
			theme: undefined,
			type: "controller",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new controller"],
		project: project
	});
});

test.serial("Add controller with valid modules", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub,
		createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "controller"],
			name: "test",
			modules: ["Sample"]
		},
		expectedMessage: "Add new controller",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [{name: "sample"}],
			namespaceList: [],
			rootView: undefined,
			route: undefined,
			theme: undefined,
			type: "controller",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new controller"],
		project: project
	});
});

test.serial("Add control", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "control"],
			name: "test"
		},
		expectedMessage: "Add new control",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [],
			namespaceList: [],
			route: undefined,
			rootView: undefined,
			theme: undefined,
			type: "control",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new control"],
		project: project
	});
});

test.serial("Add control with modules", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub,
		createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "control"],
			name: "test",
			modules: ["sample"]
		},
		expectedMessage: "Add new control",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [{name: "sample"}],
			namespaceList: [],
			route: undefined,
			rootView: undefined,
			theme: undefined,
			type: "control",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new control"],
		project: project
	});
});

test.serial("Add component", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub,
		createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "component"],
		},
		expectedMessage: "Add new Component to project",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [],
			namespaceList: [],
			route: undefined,
			rootView: undefined,
			theme: undefined,
			type: "component",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new Component to project"],
		project: project
	});
});

test.serial("Create bootstrap", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}

	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(themelibraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "bootstrap"],
			name: undefined,
			controller: false,
			route: false,
			theme: undefined
		},
		expectedMessage: "Create bootstrap for project",
		expectedMetaInfo: {
			controller: false,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: false,
			theme: undefined,
			type: "bootstrap",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Create bootstrap for project"],
		project: project
	});
});

test.serial("Create bootstrap with custom name and theme", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, createCollectionsForTreeStub} = t.context;

	const tree = {
		dependencies: [{id: "fake-dependency"}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}

	};
	generateDependencyTreeStub.resolves(tree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(themelibraryCollection);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "bootstrap"],
			name: "test",
			controller: false,
			route: false,
			theme: "sap_fancy_theme"
		},
		expectedMessage: "Create bootstrap for project",
		expectedMetaInfo: {
			controller: false,
			moduleList: [],
			namespaceList: [],
			route: false,
			rootView: undefined,
			theme: "sap_fancy_theme",
			type: "bootstrap",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Create bootstrap for project"],
		project: project
	});
});

test.serial("Add default view interactive with component selection", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub, runStub,
		createCollectionsForTreeStub} = t.context;

	const dependencyTree = {
		dependencies: [{
			id: "fake-dependency"
		}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(dependencyTree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);
	runStub.onCall(0).resolves("View");
	runStub.onCall(1).resolves("test");
	runStub.onCall(2).resolves(true);
	runStub.onCall(3).resolves(false);
	runStub.onCall(4).resolves([]);
	runStub.onCall(5).resolves(false);

	await assertCreateHandler(t, {
		argv: {
			_: ["create"],
			interactive: true
		},
		expectedMessage: "Add new view with corresponding controller",
		expectedMetaInfo: {
			controller: true,
			moduleList: [],
			namespaceList: [],
			rootView: false,
			route: false,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view with corresponding controller"],
		project: project
	});
});

test.serial("Add default view interactive without namespace selection", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub, runStub,
		createCollectionsForTreeStub} = t.context;

	const dependencyTree = {
		dependencies: []
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	const resourceEmpty = [];
	generateDependencyTreeStub.resolves(dependencyTree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resourceEmpty);
	runStub.onCall(0).resolves("test");
	runStub.onCall(1).resolves(false);
	runStub.onCall(2).resolves(false);
	runStub.onCall(3).resolves(true);

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "view"],
			interactive: true
		},
		expectedMessage: "Add new view",
		expectedMetaInfo: {
			controller: false,
			moduleList: [],
			namespaceList: [],
			route: false,
			rootView: true,
			theme: undefined,
			type: "view",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new view"],
		project: project
	});
});

test.serial("Add control interactive with component selection", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, byGlobStub, runStub,
		createCollectionsForTreeStub} = t.context;

	const dependencyTree = {
		dependencies: [{
			id: "fake-dependency"
		}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(dependencyTree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(libraryCollection);
	byGlobStub.resolves(resource);
	runStub.onCall(0).resolves("Custom Control");
	runStub.onCall(1).resolves();
	runStub.onCall(2).resolves("test");
	runStub.onCall(3).resolves([]);

	await assertCreateHandler(t, {
		argv: {
			_: ["create"],
			interactive: true
		},
		expectedMessage: "Add new control",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: undefined,
			theme: undefined,
			type: "control",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Add new control"],
		project: project
	});
});

test.serial("Create bootstrap interactive", async (t) => {
	const {generateDependencyTreeStub, processProjectStub, runStub,
		createCollectionsForTreeStub} = t.context;

	const dependencyTree = {
		dependencies: [{
			id: "fake-dependency"
		}]
	};
	const project = {
		type: "application",
		resources: {
			configuration: {
				paths: {
					webapp: "app"
				}
			}
		}
	};
	generateDependencyTreeStub.resolves(dependencyTree);
	processProjectStub.resolves(project);
	createCollectionsForTreeStub.resolves(themelibraryCollection);
	runStub.onCall(0).resolves("test");
	runStub.onCall(1).resolves("sap_fancy_theme");

	await assertCreateHandler(t, {
		argv: {
			_: ["create", "bootstrap"],
			interactive: true
		},
		expectedMessage: "Create bootstrap for project",
		expectedMetaInfo: {
			controller: undefined,
			moduleList: [],
			namespaceList: [],
			rootView: undefined,
			route: undefined,
			theme: "sap_fancy_theme",
			type: "bootstrap",
			savePath: path.join(__dirname, "..", "..", "..", "..", "app")
		},
		expectedConsoleLog: ["Create bootstrap for project"],
		project: project
	});
});