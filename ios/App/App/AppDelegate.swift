import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Print bridge (src/native.ts, plugin name "PrintPage"): window.print() does nothing in a WKWebView, so the page is handed to the system
// print dialog ("Save as PDF" / share / AirPrint). Kept in this file on purpose: it is already part of the Xcode target, so no project
// file has to be edited. NOT compiled in the sandbox that wrote it (no macOS / Xcode): the macOS job of .github/workflows/mobile.yml is
// its first compile; see packaging/README.md. NOTE: WKWebView's print formatter may ignore some @media print rules; check the practice
// sheet on a real iPad (packaging/README.md, "Test on a real device").
// ---------------------------------------------------------------------------------------------------------------------------------
@objc(PrintPagePlugin)
public class PrintPagePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrintPagePlugin"
    public let jsName = "PrintPage"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)]

    @objc func print(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "LearningCenter"
        DispatchQueue.main.async {
            guard let web = self.bridge?.webView else { call.reject("no web view"); return }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = name
            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = web.viewPrintFormatter()
            controller.present(animated: true) { _, _, error in
                if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
            }
        }
    }
}

/// The view controller of the storyboard (Main.storyboard names it): the normal Capacitor one plus the print plugin.
class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrintPagePlugin())
    }
}
