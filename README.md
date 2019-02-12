# Simple Generator
Generate template things simply and quickly.

Simple generator is just a little and simple generator.
To create a template, you just need to run `sg initTemplate` and answer several questions.

You can also call `sg initTemplate` with arguments. First argument is template name, and second is path. For example `sg Component src/components/`.

Templates are stored in a directory `.sg_templates` in the project root.
Each template has it's own directory.
You can use SG syntax in any filenames and inside files with *.sg extensions. (After generation extension will be deleted, so `test.js.sg` will become just `test.js`)

### SG syntax
SG syntax is very simple:
1) `##SG:VARIABLENAME##`

    This will simply be replaced by the value of the variable during generation.
2) `##SG:IF(VARIABLENAME)##...##SG:ENDIF(VARIABLENAME)##`

    It's simple. If at generation there will be a variable with the same name, the content in the condition will be written to the file. If not ... Well, you understand.
    
    WARN: No else, no logic. Just simplest if.

And, by the way, variable names are not case sensitive. Like, at all.


### Generation from templates
To generate from this template, just enter `sg generate YourTemplateName`

To pass variable with value use `variable_name:variable_value`, like `sg generate YourTemplateName testvar:helloworld`.

To pass variable without value (you should only use it for if, otherwise instead of variable value it will be 'undefined') use `variable_name`, like `sg generate YourTemplateName testvar`.