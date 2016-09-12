
require('babel-register')()

let gulp = require('gulp')
let jasmine = require('gulp-jasmine')

gulp.task('test', () => {
  return gulp.src('./*Spec.js')
      .pipe(jasmine())
})
