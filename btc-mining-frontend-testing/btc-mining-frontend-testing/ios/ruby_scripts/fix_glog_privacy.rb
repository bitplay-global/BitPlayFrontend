#!/usr/bin/env ruby
require 'xcodeproj'

def nuke_glog_privacy(project)
  project.targets.dup.each do |target|
    if target.name == "glog-glog_privacy"
      puts "🔥 Removing target #{target.name} from Pods.xcodeproj"
      project.targets.delete(target)
    end
  end

  # Also clean product refs (just in case)
  project.products_group.files.dup.each do |file|
    if file.path =~ /glog_privacy\.bundle/
      puts "🧹 Removing product ref: #{file.path}"
      file.remove_from_project
    end
  end

  project.save
end

pods_project_path = "Pods/Pods.xcodeproj"
if File.exist?(pods_project_path)
  pods_project = Xcodeproj::Project.open(pods_project_path)
  nuke_glog_privacy(pods_project)
end

# Also strip glog_privacy.bundle from xcfilelists & resource scripts
def strip_bundle_references
  patterns = Dir.glob("Pods/Target Support Files/Pods-BitcoinMining/*")
  patterns.each do |file|
    next unless File.file?(file)
    text = File.read(file)
    new_text = text.gsub(/.*glog_privacy\.bundle.*\n/, "")
    if text != new_text
      puts "🧹 Stripped glog_privacy.bundle from #{file}"
      File.write(file, new_text)
    end
  end
end

strip_bundle_references
puts "✅ Nuked glog_privacy completely"
