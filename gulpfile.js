console.log("Loading core plugins...");
console.time("Core plugins loaded");

var gulpCore = require('gulp'),
    gulpLoadPlugins = require('gulp-load-plugins'),
    plugins = gulpLoadPlugins({
        pattern: [
            'gulp-*',
            'gulp.*',
            'karma-*',
            'del',
            'globby',
            'lodash',
            'main-bower-files',
            'minimatch',
            'newman',
            'run-sequence',
            'json5'
        ],
        rename: {
            'gulp-angular-templatecache': 'templateCache'
        }
    }),
    gulp = plugins.help(gulpCore),
    _ = require('lodash'),
    browserSync = require('browser-sync').create()
;

console.timeEnd("Core plugins loaded");

console.log('browserSync', _.functions(browserSync));


var paths = {
    src: {
        base: 'app/src',
        get scripts(){
            return [this.base + '/**/*.js', '!'+this.base + '/**/*.spec.js']
        },
        get templates(){
            return this.base + '/**/*.tpl.html'
        },
        get styles(){
            return this.base + '/styles/**/*.less'
        },
        get assets(){
            return this.base + '/assets/images/**/*'
        },
        get tests(){
            return this.base + '/**/*.spec.js'
        }
    },
    dest: {
        base: 'app/build',
        get scripts(){
            return this.base+ '/js'
        },
        get appStyles(){
            return this.base + '/css/**/*.css'
        },
        get css(){
            return this.base + '/css'
        },
        get vendor(){
            return this.base + '/vendor'
        },
        get assets(){
            return this.base + '/assets'
        },
        get coverage(){
            return 'reports/**/lcov.info'
        }
    }
};

gulp.task('bower:install', 'installs bower dependencies', [],  function() {

    return plugins.bower({ cwd: './app', cmd: 'install'}, ['--allow-root']);

});

gulp.task('clean', 'deletes all build files', [], function(cb) {
    plugins.del([paths.dest.base], cb);
});

gulp.task('scripts', 'processes javascript files', [], function () {
    return gulp.src(paths.src.scripts)
        //.pipe(watch(paths.src.scripts))
        .pipe(plugins.ngAnnotate())
        .pipe(gulp.dest(paths.dest.scripts))
    ;
});

gulp.task('templates-watch', 'watches template files for changes [not working]', ['templates'], browserSync.reload);
gulp.task('templates', 'builds template files', [], function(){
    return gulp.src(paths.src.templates)
        .pipe(plugins.templateCache({
            root: "templates/",
            standalone: true
        }))
        .pipe(plugins.concat('templates.js'))
        .pipe(gulp.dest(paths.dest.scripts))
    ;
});

gulp.task('styles', 'compiles stylesheets', [], function(){
    return gulp.src(paths.src.styles)
        //.pipe(watch(paths.src.styles))
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.less())
        //.pipe(concatCss('app.css'))
        .pipe(plugins.sourcemaps.write('./maps'))
        .pipe(gulp.dest(paths.dest.css))
        //.on('end', function(){
        //    browserSync.reload();
        //})
    ;
});


gulp.task('assets', 'copies asset files', [], function(){
    return gulp.src(paths.src.assets)
        .pipe(gulp.dest(paths.dest.assets));
});

gulp.task('bower:build', 'compiles frontend vendor files', [], function(cb) {

    var files = plugins.mainBowerFiles({
            includeDev: true,
            paths: {
                bowerDirectory: 'app/bower_components',
                bowerJson: 'app/bower.json'
            }
        }),
        jsFilter = plugins.filter('**/*.js'),
        cssFilter = plugins.filter(['**/*.css', '**/*.css.map']),
        everythingElseFilter = plugins.filter(['**/*', '!**/*.css', '!**/*.js', '!**/*.map', '!**/*.less']),
        onError = function(cb){
            console.error(cb);
        };


    if (!files.length) {
        return cb();
    }

    gulp.src(files, {base: 'app/bower_components'})
        //javascript
        .pipe(jsFilter)
        //.pipe(sourcemaps.init())
        //.pipe(concat('vendor.js'))
        //.pipe(sourcemaps.write('./maps'))
        .on('error', onError)
        .pipe(gulp.dest(paths.dest.vendor+'/js'))
        .pipe(jsFilter.restore())
        //css
        .pipe(cssFilter)
        //.pipe(sourcemaps.init())
        //.pipe(concat('vendor.css'))
        //.pipe(sourcemaps.write('./maps'))

        .pipe(plugins.replace('../fonts/fontawesome', '/vendor/assets/font-awesome/fonts/fontawesome'))
        .on('error', onError)
        .pipe(gulp.dest(paths.dest.vendor+'/css'))
        .pipe(cssFilter.restore())

        //else
        .pipe(everythingElseFilter)
        .pipe(gulp.dest(paths.dest.vendor+'/assets'))
        .on('end', cb);

});

var getIndexFiles = function(conf){

    conf = conf || {};

    var config = _.defaults(conf, {
        devDeps: false //developer dependencies
    });

    var vendorFiles = plugins.mainBowerFiles({
        includeDev: config.devDeps,
        paths: {
            bowerDirectory: 'app/bower_components',
            bowerJson: 'app/bower.json'
        }
    });

    vendorFiles = vendorFiles.map(function(path){
        return path.replace(/\\/g, "\/").replace(/^.+bower_components\//i, '');
    });

    var files = {
        scripts: {
            app: plugins.globby.sync(paths.dest.scripts+'/**/*.js').map(function(path){
                return path.replace('app/build/', '');
            }),
            vendor: vendorFiles.filter(plugins.minimatch.filter("*.js", {matchBase: true})).map(function(path){
                return 'vendor/js/'+path;
            })
        },
        styles: {
            app: plugins.globby.sync(paths.dest.appStyles).map(function(path){
                return path.replace('app/build/', '');
            }),
            vendor: vendorFiles.filter(plugins.minimatch.filter("*.css", {matchBase: true})).map(function(path){
                return 'vendor/css/'+path;
            })
        }
    };

    return files;

};

gulp.task('index', 'processes index.html file', [], function(){

    var files = getIndexFiles();


    return gulp.src(paths.src.base+'/index.html')
        .pipe(plugins.template(files))
        .pipe(gulp.dest(paths.dest.base))
    ;

});

// The default task (called when you run `gulp` from cli)
gulp.task('default', 'default task', ['build']);

gulp.task('build', 'runs build sequence for frontend', function (cb){
    plugins.runSequence('clean',
        //'bower:install',
        ['scripts', 'templates', 'styles', 'assets', 'bower:build'],
        'index',
        cb);
});

gulp.task('watch', 'starts up browsersync server and runs task watchers', [], function() {

    /**
     * @todo resolve why this file watcher is required for browsersync to function
     * It should be possible to just add a watch task that fires reload when task runs
     * See `templates-watch` method above which does not work
     */

    browserSync.watch(paths.dest.base+'/**', function (event, file) {
        if (event === "change") {
            browserSync.reload();
        }
    });

    browserSync.init({
        proxy: "http://local.app.spira.io"
    });

    gulp.watch(paths.src.templates, ['templates']);
    gulp.watch(paths.src.scripts, ['scripts']);
    gulp.watch(paths.src.styles, ['styles']);
    gulp.watch(paths.src.assets, ['assets']);
    gulp.watch(paths.src.base+'/index.html', ['index']);

});


gulp.task('test:app',  'unit test & report frontend coverage', [], function(cb){
    plugins.runSequence('test:karma', 'test:fixcloverpaths', cb);
});

gulp.task('test:karma',  'unit test the frontend', [], function(){

    var files = getIndexFiles({
        devDeps: true
    });

    var testFiles = files.scripts.vendor
        .map(function(path){
            return 'app/build/'+path;
        })
        .concat(plugins.globby.sync(paths.src.scripts))
        .concat(plugins.globby.sync(paths.src.tests))
    ;

    testFiles.push('app/build/js/templates.js');

    return gulp.src(testFiles)
        .pipe(plugins.karma({
            configFile: 'karma.conf.js',
            action: 'run'
        }))
        .on('error', function(err) {
            // Make sure failed tests cause gulp to exit non-zero
            throw err;
        });

});

gulp.task('test:fixcloverpaths', 'Fixes clover relative paths', [], function(){

    return gulp.src('reports/coverage/app/clover.xml')
        .pipe(plugins.replace('path="./', 'path="'+ __dirname+'/'))
        .pipe(gulp.dest('reports/coverage/app'))
        .on('error', function(err) {
            // Make sure failed tests cause gulp to exit non-zero
            throw err;
        });
});

gulp.task('test:api', 'unit tests the api', [], function(){

    return gulp.src('api/phpunit.xml')
        .pipe(plugins.phpunit('./api/vendor/bin/phpunit', {
            notify: true,
            coverageClover: './reports/coverage/api/clover.xml'
        }))
        .on('error', function(err){
            plugins.notify.onError(testNotification('fail', 'phpunit'));
            throw err;
        })
        .pipe(plugins.notify(testNotification('pass', 'phpunit')))
    ;

});

gulp.task('test:postman', 'integration tests the api', [], function(callback){ //@todo fix postman not connecting with travis ci, or not returning exitcodes


    var fs = require('fs');

    var collectionJson = plugins.json5.parse(fs.readFileSync("./api/postman/spira.json.postman_collection", 'utf8'));

    var envFile = "./api/postman/spira-local.postman_environment";

    if (process.env.TRAVIS){
        envFile = "./api/postman/spira-travisci.postman_environment";
    }

    console.log('Using postman env file ', envFile);

    var environment = plugins.json5.parse(fs.readFileSync(envFile, "utf-8")); // environment file (in parsed json format)

    if (!!process.env.NGINX_PORT_8080_TCP){ //if we are executing from a docker container

        var hostEntry = _.find(environment.values, {'key':'host'}); //find the host key entry
        hostEntry.value = process.env.NGINX_PORT_8080_TCP_ADDR + ':8080'; //rewrite it to the nginx container tcp address

    }

    if (!!process.env.MAILCATCHER_PORT_1080_TCP){ //if we are executing from a docker container with mailcatcher connection

        var mcHostEntry = _.find(environment.values, {'key':'mailcatcherHost'}); //find the host key entry
        mcHostEntry.value = process.env.MAILCATCHER_PORT_1080_TCP_ADDR + ':1080'; //rewrite it to the mailcatcher container tcp address

    }

    var newmanOptions = {
        envJson: environment,
        asLibrary: true,
        stopOnError: false,
        exitCode: true
    };

    plugins.newman.execute(collectionJson, newmanOptions, function(exitCode){

        console.log('exit code', exitCode);

        if (exitCode !== 0){
            throw new Error("Postman tests failed!");
        }

        callback();
    });

});

//@todo resolve why this task will not exit, when the base task `./node_modules/.bin/cucumber.js` exits 0 as expected
gulp.task('test:cucumber', 'runs BDD integration tests', [], function() {
    return gulp.src('features/*')
        .pipe(plugins.cucumber({
        'steps': 'features/steps/*.js',
        'support': 'features/support/*.js'
    }));
});

gulp.task('test', 'executes all unit and integration tests', ['test:app', 'test:api', 'test:postman']);

gulp.task('coveralls', 'generates code coverage for the frontend', [], function(){
    gulp.src(paths.dest.coverage)
        .pipe(plugins.coveralls());
});


function testNotification(status, pluginName, override) {
    var options = {
        title:   ( status == 'pass' ) ? 'Tests Passed' : 'Tests Failed',
        message: ( status == 'pass' ) ? '\n\nAll tests have passed!\n\n' : '\n\nOne or more tests failed...\n\n',
        icon:    __dirname + '/node_modules/gulp-' + pluginName +'/assets/test-' + status + '.png'
    };
    options = _.merge(options, override);
    return options;
}
