#!/usr/bin/env ruby
require 'xcodeproj'

def nuke_bundle_targets_and_refs(project, project_name)
  project.targets.dup.each do |target|
    # Kill bundle-only targets
    if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
      puts "⚡ Nuking bundle target: #{target.name} in #{project_name}"
      project.targets.delete(target)
      next
    end

    # Kill suspicious targets by name
    if target.name =~ /(privacy|resources|bundle|filters)/i
      puts "⚡ Nuking suspicious target: #{target.name} in #{project_name}"
      project.targets.delete(target)
      next
    end

    # Remove .bundle refs from Resources phase
    if target.respond_to?(:resources_build_phase) && target.resources_build_phase
      target.resources_build_phase.files.dup.each do |file|
        if file.display_name =~ /\.bundle$/i
          puts "⚡ Removing bundle file from #{target.name}: #{file.display_name}"
          target.resources_build_phase.remove_file_reference(file.file_ref)
        end
      end
    end

    # Remove .bundle refs from Copy Pods Resources
    if target.respond_to?(:shell_script_build_phases)
      target.shell_script_build_phases.each do |phase|
        if phase.name =~ /Copy Pods Resources/
          phase.input_paths.reject! { |p| p =~ /\.bundle$/i }
          phase.output_paths.reject! { |p| p =~ /\.bundle$/i }
        end
      end
    end

    # 🔥 Remove .bundle refs from CopySwiftLibs
    if target.respond_to?(:copy_files_build_phases)
      target.copy_files_build_phases.each do |phase|
        if phase.symbol_dst_subfolder_spec == :frameworks || phase.name =~ /CopySwiftLibs/i
          phase.files_references.dup.each do |ref|
            if ref.path =~ /\.bundle$/i
              puts "⚡ Removing bundle ref from CopySwiftLibs in #{target.name}: #{ref.path}"
              phase.remove_file_reference(ref)
            end
          end
        end
      end
    end
  end

  project.save
end

pods_project_path = 'Pods/Pods.xcodeproj'
app_project_path = 'BitcoinMining.xcodeproj'

if File.exist?(pods_project_path)
  pods_project = Xcodeproj::Project.open(pods_project_path)
  nuke_bundle_targets_and_refs(pods_project, "Pods")
end

if File.exist?(app_project_path)
  app_project = Xcodeproj::Project.open(app_project_path)
  nuke_bundle_targets_and_refs(app_project, "App")
end

puts "✅ Finished nuking bundles"

def strip_bundle_references_from_xcconfigs
  Dir.glob("Pods/Target Support Files/**/*.xcconfig").each do |xcconfig|
    text = File.read(xcconfig)
    new_text = text.gsub(/.*\.bundle.*\n/, "")
    if text != new_text
      puts "🧹 Stripped bundle refs from #{xcconfig}"
      File.write(xcconfig, new_text)
    end
  end
end

strip_bundle_references_from_xcconfigs