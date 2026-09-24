#!/usr/bin/env ruby
# clean_pods_bundles.rb

def strip_bundle_references
  patterns = [
    "Pods/Target Support Files/Pods-BitcoinMining/Pods-BitcoinMining-resources.sh",
    "Pods/Target Support Files/Pods-BitcoinMining/Pods-BitcoinMining-resources-Debug-input-files.xcfilelist",
    "Pods/Target Support Files/Pods-BitcoinMining/Pods-BitcoinMining-resources-Debug-output-files.xcfilelist",
    "Pods/Target Support Files/Pods-BitcoinMining/Pods-BitcoinMining-resources-Release-input-files.xcfilelist",
    "Pods/Target Support Files/Pods-BitcoinMining/Pods-BitcoinMining-resources-Release-output-files.xcfilelist"
  ]

  patterns.each do |file|
    next unless File.exist?(file)
    text = File.read(file)
    new_text = text.gsub(/.*glog_privacy\.bundle.*\n/, "")
    if text != new_text
      puts "🧹 Stripped glog_privacy.bundle from #{file}"
      File.write(file, new_text)
    end
  end
end

strip_bundle_references
puts "✅ Done stripping glog_privacy.bundle"